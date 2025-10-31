import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
	NotImplementedException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import { ContractArbitration } from "../../escrows/arbitration/contract-arbitration.entity";
import {
	Cursor,
	cursorToString,
	emptyCursor,
} from "../../common/dto/envelopes";
import { EscrowContract } from "../../escrows/contracts/escrow-contract.entity";
import { ContractExecution } from "../../escrows/contracts/contract-execution.entity";
import { GetAdminEscrowContractDto } from "./get-admin-escrow-contract.dto";
import { GetAdminEscrowContractDetailsDto } from "./get-admin-escrow-contract-details.dto";
import { Subject } from "rxjs";
import { schnorr } from "@noble/secp256k1";
import { hexToBytes } from "@noble/hashes/utils.js";
import { ConfigService } from "@nestjs/config";
import { base64 } from "@scure/base";

import { ArbitrateDisputeInDto } from "./arbitrate-dispute-in.dto";
import { ArkService } from "../../ark/ark.service";
import GetAdminStatsDto from "./get-admin-stats";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
	ARBITRATION_RESOLVED,
	ArbitrationResolved,
} from "../../common/arbitration.event";
import { nanoid } from "nanoid";

type AdminEvent = {
	type: "updated_contract";
	externalId: string;
};

@Injectable()
export class AdminService {
	private readonly logger = new Logger(AdminService.name);
	// Subject that acts as an event emitter
	private readonly events$ = new Subject<AdminEvent>();
	private readonly arbitratorPublicKey: string;
	private readonly arbitratorPrivateKey: string;

	constructor(
		@InjectRepository(EscrowContract)
		private readonly contractRepository: Repository<EscrowContract>,
		@InjectRepository(ContractExecution)
		private readonly contractExecutionRepository: Repository<ContractExecution>,
		@InjectRepository(ContractArbitration)
		private readonly arbitrationRepository: Repository<ContractArbitration>,
		private readonly arkService: ArkService,
		private readonly configService: ConfigService,
		private readonly events: EventEmitter2,
	) {
		const pubKey = configService.get<string>("ARBITRATOR_PUB_KEY");
		if (pubKey === undefined) {
			throw new Error("ARBITRATOR_PUB_KEY is not set");
		}
		this.arbitratorPublicKey = pubKey;
		const privKey = configService.get<string>("ARBITRATOR_PRIV_KEY");
		if (privKey === undefined) {
			throw new Error("ARBITRATOR_PRIV_KEY is not set");
		}
		this.arbitratorPrivateKey = privKey;
	}

	async getContractStats(): Promise<GetAdminStatsDto["contracts"]> {
		const [total, active, disputed, settled] = await Promise.all([
			this.contractRepository.count(),
			this.contractRepository.count({
				where: { status: In(["created", "funded", "pending-execution"]) },
			}),
			this.contractRepository.count({ where: { status: "under-arbitration" } }),
			this.contractRepository.count({ where: { status: "completed" } }),
		]);
		return {
			total,
			active,
			disputed,
			settled,
		};
	}

	async findAll(
		limit: number,
		cursor: Cursor = emptyCursor,
	): Promise<{
		items: GetAdminEscrowContractDto[];
		nextCursor?: string;
		total: number;
	}> {
		const take = Math.min(limit, 100);

		const qb = this.contractRepository.createQueryBuilder("r");
		qb.leftJoinAndSelect("r.request", "request");

		if (cursor.createdBefore !== undefined && cursor.idBefore !== undefined) {
			qb.andWhere(
				new Brackets((w) => {
					w.where("r.createdAt < :createdBefore", {
						createdBefore: cursor.createdBefore,
					}).orWhere(
						new Brackets((w2) => {
							w2.where("r.createdAt = :createdAtEq", {
								createdAtEq: cursor.createdBefore,
							}).andWhere("r.id < :idBefore", { idBefore: cursor.idBefore });
						}),
					);
				}),
			);
		}

		const rows = await qb
			.orderBy("r.createdAt", "DESC")
			.addOrderBy("r.id", "DESC")
			.take(take)
			.getMany();

		const total = await this.contractRepository.count();

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}

		const items: GetAdminEscrowContractDto[] = rows.map((r) => ({
			externalId: r.externalId,
			requestId: r.request.externalId,
			senderPublicKey: r.senderPubkey,
			receiverPublicKey: r.receiverPubkey,
			amount: r.amount,
			side: r.request.side,
			description: r.request.description,
			status: r.status,
			arkAddress: r.arkAddress,
			virtualCoins: r.virtualCoins,
			createdAt: r.createdAt.getTime(),
			updatedAt: r.updatedAt.getTime(),
			acceptedAt: r.acceptedAt?.getTime(),
			canceledAt: r.canceledAt?.getTime(),
		}));

		return { items, nextCursor, total };
	}

	async getContractDetails(
		externalId: string,
	): Promise<GetAdminEscrowContractDetailsDto> {
		const contract = await this.contractRepository.findOne({
			where: { externalId },
		});
		if (!contract) throw new NotFoundException("Contract not found");
		const executions = await this.contractExecutionRepository.find({
			where: { contract: { externalId } },
		});
		const arbitrations = await this.arbitrationRepository.find({
			where: { contract: { externalId } },
		});
		return {
			externalId: contract.externalId,
			requestId: contract.request.externalId,
			senderPublicKey: contract.senderPubkey,
			receiverPublicKey: contract.receiverPubkey,
			amount: contract.amount,
			side: contract.request.side,
			description: contract.request.description,
			status: contract.status,
			arkAddress: contract.arkAddress,
			virtualCoins: contract.virtualCoins ?? [],
			executions: executions.map((e) => ({
				externalId: e.externalId,
				initiatedByPubKey: e.initiatedByPubKey,
				status: e.status,
				transaction: e.cleanTransaction,
				contract: undefined,
				contractId: e.contract.externalId,
				createdAt: e.createdAt.getTime(),
				updatedAt: e.updatedAt.getTime(),
			})),
			arbitrations: arbitrations.map((a) => ({
				externalId: a.externalId,
				contractId: a.contract.externalId,
				claimantPublicKey: a.claimantPubkey,
				defendantPublicKey: a.defendantPubkey,
				reason: a.reason,
				status: a.status,
				verdict: a.verdict,
				createdAt: a.createdAt.getTime(),
				updatedAt: a.updatedAt.getTime(),
			})),
			createdAt: contract.createdAt.getTime(),
			updatedAt: contract.updatedAt.getTime(),
			acceptedAt: contract.acceptedAt?.getTime(),
			canceledAt: contract.canceledAt?.getTime(),
		};
	}

	async arbitrateDispute(input: {
		contractId: string;
		arbitrationId: string;
		action: ArbitrateDisputeInDto["action"];
	}) {
		const contract = await this.contractRepository.findOne({
			where: { externalId: input.contractId },
		});
		const arbitration = await this.arbitrationRepository.findOne({
			where: { externalId: input.arbitrationId },
		});
		if (!contract || !arbitration)
			throw new NotFoundException("Contract or arbitration not found");
		if (contract.status !== "under-arbitration") {
			this.logger.error(
				`Contract ${input.contractId} has status ${contract.status}, cannot arbitrate`,
			);
			throw new UnprocessableEntityException(
				"Contract is not under arbitration",
			);
		}
		if (arbitration.status !== "pending") {
			throw new UnprocessableEntityException(
				`Arbitration ${input.arbitrationId} has status ${arbitration.status}, cannot arbitrate`,
			);
		}
		const successfulExecutions = await this.contractExecutionRepository.find({
			where: [
				{ contract: { externalId: input.contractId } },
				{ status: "executed" },
			],
		});
		if (successfulExecutions.length > 0) {
			throw new ConflictException(
				`Contract has been executed via ${successfulExecutions.map((_) => _.id)}`,
			);
		}

		// TODO 4. invalidate all contract executions
		// const invalidationResult = await this.contractExecutionRepository
		// 	.createQueryBuilder()
		// 	.update(ContractExecution)
		// 	.set({ status: "canceled-by-arbitrator" })
		// 	.where("status IN :statuses", {
		// 		statuses: [
		// 			"pending-initiator-signature",
		// 			"pending-counterparty-signature",
		// 			"pending-server-confirmation",
		// 		],
		// 	})
		// 	.execute();
		// this.logger.log(
		// 	`${invalidationResult.affected} executions invalidated for contract ${input.contractId}`,
		// );

		const persisted = await this.arbitrationRepository.save({
			...arbitration,
			status: "resolved",
			verdict: this.verdictFromAction(input.action),
		});

		this.events.emit(ARBITRATION_RESOLVED, {
			eventId: nanoid(16),
			contractId: input.contractId,
			arbitrationId: persisted.externalId,
			resolvedAt: new Date().toISOString(),
		} satisfies ArbitrationResolved);

		return persisted;
	}

	private verdictFromAction(action: ArbitrateDisputeInDto["action"]) {
		switch (action) {
			case "settle":
				return "release";
			case "refund":
				return "refund";
			default:
				throw new BadRequestException(`Unsupported action ${action}`);
		}
	}

	/*
    rec ---> dispute
    arb ---> release ---> ask address from rec
     */

	// TODO: implement arbitration
	// private async executeSettlement(contract: EscrowContract) {
	// 	try {
	// 		const escrowTransaction = await this.arkService.createEscrowTransaction(
	// 			{
	// 				action: "release-funds",
	// 				// TODO: get the ark address of the receiver!
	// 				receiverAddress: ArkAddress.decode(),
	// 				receiverPublicKey: contract.receiverPubkey,
	// 				senderPublicKey: contract.senderPubkey,
	// 				arbitratorPublicKey: this.arbitratorPublicKey,
	// 				contractNonce: `${contract.externalId}${contract.request.externalId}`,
	// 			},
	// 			vtxo,
	// 		);
	// 	} catch (e) {}
	// }

	private executeRefund() {
		throw new NotImplementedException();
	}
}
