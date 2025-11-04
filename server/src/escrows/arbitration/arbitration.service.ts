import {
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Brackets, Repository } from "typeorm";
import { nanoid } from "nanoid";

import { PublicKey } from "../../common/PublicKey";
import { ContractArbitration } from "./contract-arbitration.entity";
import {
	ContractStatus,
	EscrowContract,
} from "../contracts/escrow-contract.entity";
import { User } from "../../users/user.entity";
import { GetArbitrationDto } from "./dto/get-arbitration.dto";
import {
	Cursor,
	cursorToString,
	emptyCursor,
} from "../../common/dto/envelopes";
import { ArkAddress, Identity, SingleKey, Transaction } from "@arkade-os/sdk";
import { ArkService, EscrowTransaction } from "../../ark/ark.service";
import { ContractExecution } from "../contracts/contract-execution.entity";
import { ExecuteEscrowContractOutDto } from "../contracts/dto/execute-escrow-contract.dto";
import { base64 } from "@scure/base";
import { hexToBytes } from "@noble/hashes/utils.js";
import { toError } from "../../common/errors";

type ArbitrationQueryFilter = {
	contractId?: string;
};

@Injectable()
export class ArbitrationService {
	private readonly logger = new Logger(ArbitrationService.name);
	private readonly arbitratorPublicKey: string;
	private readonly identity: Identity;

	constructor(
		// biome-ignore lint/correctness/noUnusedPrivateClassMembers: may be used in tests
		private readonly configService: ConfigService,
		@InjectRepository(ContractArbitration)
		private readonly arbitrationRepository: Repository<ContractArbitration>,
		@InjectRepository(EscrowContract)
		private readonly contractRepository: Repository<EscrowContract>,
		@InjectRepository(ContractExecution)
		private readonly contractExecutionRepository: Repository<ContractExecution>,
		private readonly arkService: ArkService,
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
		this.identity = SingleKey.fromPrivateKey(hexToBytes(privKey));
	}

	async createArbitration(input: {
		contractId: string;
		reason: string;
		claimantPublicKey: string;
	}): Promise<GetArbitrationDto> {
		const contract = await this.getOneForPartyAndStatus(
			input.contractId,
			input.claimantPublicKey,
			["funded", "pending-execution"],
		);
		if (!contract) {
			throw new NotFoundException(
				`Contract ${input.contractId} with status 'funded' or 'pending-execution' not found for ${input.claimantPublicKey}`,
			);
		}
		const entity = this.arbitrationRepository.create({
			externalId: nanoid(16),
			contract: { externalId: input.contractId } as Pick<
				EscrowContract,
				"externalId"
			>,
			claimantPubkey: input.claimantPublicKey,
			defendantPubkey:
				contract.senderPubkey === input.claimantPublicKey
					? contract.receiverPubkey
					: contract.senderPubkey,
			reason: input.reason,
			arbitratorPubkey: this.arbitratorPublicKey,
			status: "pending",
		});
		const newArbitration = await this.arbitrationRepository.save(entity);
		await this.contractRepository.update(
			{ externalId: contract.externalId },
			{
				status: "under-arbitration",
			},
		);
		return {
			externalId: newArbitration.externalId,
			contractId: contract.externalId,
			claimantPublicKey: newArbitration.claimantPubkey,
			defendantPublicKey: newArbitration.defendantPubkey,
			reason: newArbitration.reason,
			status: newArbitration.status,
			createdAt: newArbitration.createdAt.getTime(),
			updatedAt: newArbitration.updatedAt.getTime(),
		};
	}

	async getByUser(
		pubKey: string,
		filter: ArbitrationQueryFilter,
		limit: number,
		cursor: Cursor = emptyCursor,
	): Promise<{
		items: GetArbitrationDto[];
		nextCursor?: string;
		total: number;
	}> {
		const take = Math.min(limit, 100);

		const qb = this.arbitrationRepository.createQueryBuilder("r").where(
			new Brackets((w) => {
				if (filter.contractId) {
					w.andWhere("r.contract.externalId = :contractId", {
						contractId: filter.contractId,
					});
				}
				w.where("r.claimantPubkey = :pubKey", { pubKey }).orWhere(
					"r.defendantPubkey = :pubKey",
					{ pubKey },
				);
			}),
		);

		qb.leftJoinAndSelect("r.contract", "contract");

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

		// total respecting the same filters (including status if present)
		const total = await this.arbitrationRepository.count({
			where: [{ claimantPubkey: pubKey }, { defendantPubkey: pubKey }],
		});

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}
		const items: GetArbitrationDto[] = rows.map((r) => ({
			externalId: r.externalId,
			contractId: r.contract.externalId,
			claimantPublicKey: r.claimantPubkey,
			defendantPublicKey: r.defendantPubkey,
			reason: r.reason,
			status: r.status,
			verdict: r.verdict,
			createdAt: r.createdAt.getTime(),
			updatedAt: r.updatedAt.getTime(),
		}));

		return { items, nextCursor, total };
	}

	async getOneByExternalId(
		externalId: string,
		user: User,
	): Promise<GetArbitrationDto> {
		const arbitration = await this.arbitrationRepository.findOne({
			where: [{ externalId }],
		});
		if (!arbitration) throw new NotFoundException("Arbitration not found");
		if (
			arbitration.claimantPubkey !== user.publicKey &&
			arbitration.defendantPubkey !== user.publicKey
		) {
			throw new ForbiddenException("Unauthorized");
		}
		return {
			externalId: arbitration.externalId,
			contractId: arbitration.contract.externalId,
			claimantPublicKey: arbitration.claimantPubkey,
			defendantPublicKey: arbitration.defendantPubkey,
			reason: arbitration.reason,
			status: arbitration.status,
			verdict: arbitration.verdict,
			createdAt: arbitration.createdAt.getTime(),
			updatedAt: arbitration.updatedAt.getTime(),
		};
	}

	async createArbitrationExecution(
		input: {
			externalId: string;
			arkAddress: string;
		},
		user: User,
	): Promise<ExecuteEscrowContractOutDto> {
		const arbitration = await this.arbitrationRepository.findOne({
			where: [{ externalId: input.externalId }],
		});
		if (!arbitration) throw new NotFoundException("Arbitration not found");
		if (
			arbitration.claimantPubkey !== user.publicKey &&
			arbitration.defendantPubkey !== user.publicKey
		) {
			throw new ForbiddenException("Unauthorized");
		}
		if (arbitration.status !== "resolved") {
			throw new UnprocessableEntityException("Arbitration is not resolved");
		}
		if (!arbitration.verdict) {
			throw new InternalServerErrorException(
				"Arbitration has no verdict but status resolved",
			);
		}
		const contract = await this.contractRepository.findOne({
			where: { externalId: arbitration.contract.externalId },
		});
		if (!contract) throw new NotFoundException("Contract not found");
		if (contract.status !== "under-arbitration") {
			throw new InternalServerErrorException(
				"Contract is not under arbitration",
			);
		}
		if (!contract.virtualCoins || contract.virtualCoins.length === 0) {
			throw new InternalServerErrorException("Contract  is not funded");
		}
		const vtxo = contract.virtualCoins[0];
		switch (arbitration.verdict) {
			case "release": {
				if (contract.receiverPubkey !== user.publicKey) {
					throw new ForbiddenException(
						"User is not the receiver, cannot release funds",
					);
				}
				const escrowTransaction = await this.arkService.createEscrowTransaction(
					{
						action: "release-funds",
						receiverAddress: ArkAddress.decode(input.arkAddress),
						receiverPublicKey: contract.receiverPubkey,
						senderPublicKey: contract.senderPubkey,
						arbitratorPublicKey: this.arbitratorPublicKey,
						contractNonce: `${contract.externalId}${contract.request.externalId}`,
					},
					vtxo,
				);
				const { signedTx, signedCheckpoints } =
					await this.signArbitrationTx(escrowTransaction);
				const entity = this.contractExecutionRepository.create({
					action: "release-funds",
					externalId: nanoid(16),
					contract: { externalId: contract.externalId } as Pick<
						EscrowContract,
						"externalId"
					>,
					initiatedByPubKey: this.arbitratorPublicKey,
					status: "pending-counterparty-signature",
					cleanTransaction: {
						vtxo: {
							txid: vtxo.txid,
							vout: vtxo.vout,
							value: vtxo.value,
						},
						arkTx: escrowTransaction.arkTx,
						checkpoints: escrowTransaction.checkpoints,
						requiredSigners: escrowTransaction.requiredSigners,
						approvedByPubKeys: [this.arbitratorPublicKey],
						rejectedByPubKeys: [],
					},
					signedTransaction: {
						arkTx: signedTx,
						checkpoints: signedCheckpoints,
					},
				});

				const persisted = await this.contractExecutionRepository.save(entity);
				return {
					externalId: persisted.externalId,
					contractId: persisted.contract.externalId,
					arkTx: persisted.cleanTransaction.arkTx,
					checkpoints: persisted.cleanTransaction.checkpoints,
					vtxo: persisted.cleanTransaction.vtxo,
				};
			}
			case "refund": {
				if (contract.senderPubkey !== user.publicKey) {
					throw new ForbiddenException(
						"User is not the sender, cannot return funds",
					);
				}
				const escrowTransaction = await this.arkService.createEscrowTransaction(
					{
						action: "return-funds",
						receiverPublicKey: contract.receiverPubkey,
						senderPublicKey: contract.senderPubkey,
						senderAddress: ArkAddress.decode(input.arkAddress),
						arbitratorPublicKey: this.arbitratorPublicKey,
						contractNonce: `${contract.externalId}${contract.request.externalId}`,
					},
					vtxo,
				);
				const { signedTx, signedCheckpoints } =
					await this.signArbitrationTx(escrowTransaction);
				const entity = this.contractExecutionRepository.create({
					action: "return-funds",
					externalId: nanoid(16),
					contract: { externalId: contract.externalId } as Pick<
						EscrowContract,
						"externalId"
					>,
					initiatedByPubKey: this.arbitratorPublicKey,
					status: "pending-counterparty-signature",
					cleanTransaction: {
						vtxo: {
							txid: vtxo.txid,
							vout: vtxo.vout,
							value: vtxo.value,
						},
						arkTx: escrowTransaction.arkTx,
						checkpoints: escrowTransaction.checkpoints,
						requiredSigners: escrowTransaction.requiredSigners,
						approvedByPubKeys: [this.arbitratorPublicKey],
						rejectedByPubKeys: [],
					},
					signedTransaction: {
						arkTx: signedTx,
						checkpoints: signedCheckpoints,
					},
				});

				const persisted = await this.contractExecutionRepository.save(entity);
				return {
					externalId: persisted.externalId,
					contractId: persisted.contract.externalId,
					arkTx: persisted.cleanTransaction.arkTx,
					checkpoints: persisted.cleanTransaction.checkpoints,
					vtxo: persisted.cleanTransaction.vtxo,
				};
			}
			default:
				throw new InternalServerErrorException(
					`Verdict ${arbitration.verdict} not supported`,
				);
		}
	}

	private async signArbitrationTx(
		escrowTransaction: EscrowTransaction,
	): Promise<{
		signedTx: string;
		signedCheckpoints: string[];
	}> {
		try {
			const signedTx = await this.identity.sign(
				Transaction.fromPSBT(base64.decode(escrowTransaction.arkTx), {
					allowUnknown: true,
				}),
			);
			const signedCheckpoints = await Promise.all(
				escrowTransaction.checkpoints.map((_) =>
					this.identity.sign(Transaction.fromPSBT(base64.decode(_))),
				),
			);
			return {
				signedTx: base64.encode(signedTx.toPSBT()),
				signedCheckpoints: signedCheckpoints.map((_) =>
					base64.encode(_.toPSBT()),
				),
			};
		} catch (e) {
			const error = toError(e);
			this.logger.error(
				`Error signing arbitration transaction: ${error.message}`,
				error,
			);
			throw error;
		}
	}

	private getOneForPartyAndStatus(
		contractId: string,
		party: PublicKey,
		status?: ContractStatus | ContractStatus[],
	): Promise<EscrowContract | null> {
		const qb = this.contractRepository
			.createQueryBuilder("c")
			.where("c.externalId = :contractId", { contractId })
			.andWhere(
				new Brackets((w) => {
					w.where("c.senderPubkey = :party", { party }).orWhere(
						"c.receiverPubkey = :party",
						{ party },
					);
				}),
			);

		if (Array.isArray(status)) {
			qb.andWhere("c.status IN (:...status)", { status });
		} else if (typeof status === "string") {
			qb.andWhere("c.status = :status", { status });
		}

		return qb.getOne();
	}
}
