import {
	ConflictException,
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	NotImplementedException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Brackets, EntityManager, Repository } from "typeorm";
import { nanoid } from "nanoid";

import { ArkService, EscrowTransaction } from "../../ark/ark.service";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { EscrowContract } from "./escrow-contract.entity";
import {
	CONTRACT_CREATED_ID,
	CONTRACT_FUNDED_ID,
	ContractCreated,
	ContractFunded,
} from "../../common/contract-address.event";
import { randomUUID } from "node:crypto";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";

import { GetEscrowContractDto } from "./dto/get-escrow-contract.dto";
import {
	Cursor,
	cursorToString,
	emptyCursor,
} from "../../common/dto/envelopes";
import {
	ContractAction,
	ExecuteEscrowContractOutDto,
} from "./dto/execute-escrow-contract.dto";
import {
	ContractExecution,
	ExecutionTransaction,
} from "./contract-execution.entity";
import { VirtualCoin } from "@arkade-os/sdk";
import { GetExecutionsByContractDto } from "./dto/get-executions-by-contract";

@Injectable()
export class EscrowsContractsService {
	private readonly logger = new Logger(EscrowsContractsService.name);

	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(EscrowContract)
		private readonly contractRepository: Repository<EscrowContract>,
		@InjectRepository(ContractExecution)
		private readonly contractExecutionRepository: Repository<ContractExecution>,
		private readonly arkService: ArkService,
		private readonly events: EventEmitter2,
	) {}

	async createContractForRequest(input: {
		requestExternalId: string;
		senderPubKey: string;
		receiverPubKey: string;
		amount: number;
	}) {
		const arbitratorPubKey = this.configService.get("ARBITRATOR_PUB_KEY");
		if (!arbitratorPubKey) {
			throw new Error("ARBITRATOR_PUB_KEY is not set");
		}
		if (input.senderPubKey === arbitratorPubKey) {
			throw new Error("Cannot create a contract with the arbitrator as sender");
		}
		if (input.receiverPubKey === arbitratorPubKey) {
			throw new Error(
				"Cannot create a contract with the arbitrator as receiver",
			);
		}
		const arkAddress = this.arkService.createArkAddressForContract({
			receiver: {
				pubKey: input.receiverPubKey,
			},
			sender: {
				pubKey: input.senderPubKey,
			},
			arbitrator: {
				pubKey: arbitratorPubKey,
			},
		});

		const entity = this.contractRepository.create({
			externalId: nanoid(16),
			request: { externalId: input.requestExternalId } as Pick<
				EscrowRequest,
				"externalId"
			>,
			senderPubkey: input.senderPubKey,
			receiverPubkey: input.receiverPubKey,
			amount: input.amount ?? 0,
			arkAddress: arkAddress.encode(),
		});
		this.events.emit(CONTRACT_CREATED_ID, {
			eventId: randomUUID(),
			contractId: entity.externalId,
			arkAddress,
			createdAt: new Date().toISOString(),
		} satisfies ContractCreated);
		return await this.contractRepository.save(entity);
	}

	async cancelContract(contractId: string): Promise<void> {
		// TODO: mark cancelled and look up arkAddress, cannot cancel if funded?
		// this.events.emit(CONTRACT_VOIDED_ID, {
		// 	eventId: randomUUID(),
		// 	contractId,
		// 	arkAddress,
		// 	reason: "cancelled_by_user",
		// 	voidedAt: new Date().toISOString(),
		// } satisfies ContractAddressVoidedEvent);
	}

	/*
	 * Cursor is base64(`${createdAtMs}:${id}`).
	 * Returns the current page and the nextCursor (if more items exist), plus total public items.
	 */
	async getByUser(
		pubKey: string,
		limit: number,
		cursor: Cursor = emptyCursor,
	): Promise<{
		items: GetEscrowContractDto[];
		nextCursor?: string;
		total: number;
	}> {
		const take = Math.min(limit, 100);

		const qb = this.contractRepository.createQueryBuilder("r").where(
			new Brackets((w) => {
				w.where("r.senderPubkey = :pubKey", { pubKey }).orWhere(
					"r.receiverPubkey = :pubKey",
					{ pubKey },
				);
			}),
		);

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

		const total = await this.contractRepository.count({
			where: [{ senderPubkey: pubKey }, { receiverPubkey: pubKey }],
		});

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}

		const items: GetEscrowContractDto[] = rows.map((r) => ({
			externalId: r.externalId,
			requestId: r.request.externalId,
			sender: r.senderPubkey,
			receiver: r.receiverPubkey,
			amount: r.amount,
			arkAddress: r.arkAddress,
			status: r.status,
			balance: r.virtualCoins?.reduce((a, _) => a + _.value, 0) ?? 0,
			createdAt: r.createdAt.getTime(),
			updatedAt: r.updatedAt.getTime(),
		}));

		return { items, nextCursor, total };
	}

	async createContractExecution(
		externalId: string,
		action: ContractAction,
		initiatorPubKey: string,
	): Promise<ExecuteEscrowContractOutDto> {
		const contract = await this.contractRepository.findOne({
			where: { externalId },
		});
		if (!contract) {
			throw new NotFoundException(`Contract ${externalId} not found`);
		}
		if (action === "direct-settle") {
			const contractExecution = await this.executeDirectSettlement(
				contract,
				initiatorPubKey,
			);
			return {
				externalId: contractExecution.externalId,
				contractId: contractExecution.contract.externalId,
				arkTx: contractExecution.transaction.arkTx,
				checkpoints: contractExecution.transaction.checkpoints,
				vtxo: contractExecution.transaction.vtxo,
			};
		}
		throw new NotImplementedException(`Action ${action} not implemented`);
	}

	private async executeDirectSettlement(
		contract: EscrowContract,
		initiatorPubKey: string,
	) {
		if (
			contract.status !== "funded" ||
			!contract.virtualCoins ||
			contract.virtualCoins.length === 0
		) {
			throw new UnprocessableEntityException("Contract  is not funded");
		}
		if (
			contract.senderPubkey !== initiatorPubKey &&
			contract.receiverPubkey !== initiatorPubKey
		) {
			throw new ForbiddenException(
				"Only the sender or receiver can execute this action",
			);
		}
		const vtxo = contract.virtualCoins[0];
		this.logger.debug(
			`Contract ${contract.externalId} direct settlement using vtxo ${vtxo.txid} value ${vtxo.value}`,
		);
		const arbitratorPubKey =
			this.configService.get<string>("ARBITRATOR_PUB_KEY") ?? "";
		try {
			const escrowTransaction = await this.arkService.createEscrowTransaction(
				{
					receiver: {
						pubKey: contract.receiverPubkey,
						address: contract.receiverAddress,
					},
					sender: {
						pubKey: contract.senderPubkey,
						address: contract.senderAddress,
					},
					arbitrator: {
						pubKey: arbitratorPubKey,
					},
				},
				"direct-settle",
				vtxo,
			);

			const entity = this.contractExecutionRepository.create({
				externalId: nanoid(16),
				contract: { externalId: contract.externalId } as Pick<
					EscrowContract,
					"externalId"
				>,
				initiatedByPubKey: initiatorPubKey,
				status: "pending-initiator-signature",
				transaction: {
					vtxo: {
						txid: vtxo.txid,
						vout: vtxo.vout,
						value: vtxo.value,
					},
					arkTx: Array.from(escrowTransaction.arkTx.toPSBT()),
					checkpoints: escrowTransaction.checkpoints.map((_) =>
						Array.from(_.toPSBT()),
					),
					requiredSignersPubKeys: escrowTransaction.requiredSigners,
					approvedByPubKeys: [],
					rejectedByPubKeys: [],
				},
			});
			const persisted = await this.contractExecutionRepository.save(entity);
			return persisted;
		} catch (e) {
			this.logger.error("Failed to create escrow transaction", e);
			throw new InternalServerErrorException(
				"Failed to create escrow transaction",
				{ cause: e },
			);
		}
	}

	@OnEvent(CONTRACT_FUNDED_ID)
	async onContractFunded(evt: ContractFunded) {
		this.logger.debug(`Contract ${evt.contractId} funded ${evt.amountSats}`);
		const contract = await this.contractRepository.findOne({
			where: { externalId: evt.contractId },
		});
		if (!contract) {
			this.logger.error(
				`Contract ${evt.contractId} not found for event ${CONTRACT_FUNDED_ID}`,
			);
			return;
		}
		if (!["created", "funded"].includes(contract.status)) {
			this.logger.warn(
				`Contract ${evt.contractId} with status ${contract.status} received event ${CONTRACT_FUNDED_ID}`,
			);
		}
		await this.contractRepository.update(
			{ externalId: contract.externalId },
			{
				status: "funded",
				virtualCoins: evt.vtxos,
			},
		);
	}

	async findByRequestId(requestExternalId: string) {
		return await this.contractRepository.findOne({
			where: {
				request: { externalId: requestExternalId },
			},
		});
	}

	async getOneByExternalId(
		externalId: string,
		pubKey: string,
	): Promise<GetEscrowContractDto> {
		const contract = await this.contractRepository.findOne({
			where: { externalId },
		});
		if (contract === null) {
			throw new NotFoundException("Contract not found");
		}
		if (
			contract?.senderPubkey !== pubKey &&
			contract?.receiverPubkey !== pubKey
		) {
			throw new ForbiddenException("Not allowed to access this contract");
		}
		const executions = await this.contractExecutionRepository.find({
			where: { contract: { externalId: contract.externalId } },
			order: { createdAt: "DESC" },
		});

		return {
			externalId: contract.externalId,
			requestId: contract.request.externalId,
			sender: contract.senderPubkey,
			receiver: contract.receiverPubkey,
			amount: contract.amount,
			arkAddress: contract.arkAddress,
			status: contract.status,
			cancelationReason: contract.cancelationReason,
			virtualCoins: contract.virtualCoins,
			lastExecution: executions[0],
			createdAt: contract.createdAt.getTime(),
			updatedAt: contract.updatedAt.getTime(),
		};
	}

	async getAllExecutionsByContractId(
		contractId: string,
		pubKey: string,
	): Promise<GetExecutionsByContractDto[]> {
		const contract = await this.contractRepository.findOne({
			where: { externalId: contractId },
		});
		if (contract === null) {
			throw new NotFoundException("Contract not found");
		}
		if (
			contract?.senderPubkey !== pubKey &&
			contract?.receiverPubkey !== pubKey
		) {
			throw new ForbiddenException("Not allowed to access this contract");
		}
		const executions = await this.contractExecutionRepository.find({
			where: { contract: { externalId: contract.externalId } },
		});
		return executions.map((e) => ({
			externalId: e.externalId,
			initiatedByPubKey: e.initiatedByPubKey,
			status: e.status,
			rejectionReason: e.rejectionReason,
			cancelationReason: e.cancelationReason,
			transaction: e.transaction,
			createdAt: e.createdAt.getTime(),
			updatedAt: e.updatedAt.getTime(),
		}));
	}
}
