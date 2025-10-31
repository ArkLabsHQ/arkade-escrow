import {
	BadRequestException,
	ConflictException,
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
import { randomUUID } from "node:crypto";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { ArkAddress, verifyTapscriptSignatures } from "@arkade-os/sdk";
import { Transaction } from "@scure/btc-signer";
import { base64 } from "@scure/base";

import { ArkService } from "../../ark/ark.service";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { ContractStatus, EscrowContract } from "./escrow-contract.entity";
import {
	CONTRACT_CREATED_ID,
	CONTRACT_DRAFTED_ID,
	CONTRACT_EXECUTED_ID,
	CONTRACT_FUNDED_ID,
	CONTRACT_VOIDED_ID,
	ContractCreated,
	ContractDrafted,
	ContractExecuted,
	ContractFunded,
	ContractVoided,
} from "../../common/contract-address.event";
import { GetEscrowContractDto } from "./dto/get-escrow-contract.dto";
import {
	Cursor,
	cursorToString,
	emptyCursor,
} from "../../common/dto/envelopes";
import { ExecuteEscrowContractOutDto } from "./dto/execute-escrow-contract.dto";
import {
	ContractExecution,
	ExecutionStatus,
	ExecutionTransaction,
} from "./contract-execution.entity";
import { GetExecutionByContractDto } from "./dto/get-execution-by-contract";
import { DraftEscrowContractOutDto } from "./dto/create-escrow-contract.dto";
import { PublicKey } from "../../common/PublicKey";
import { Signers } from "../../ark/escrow";
import * as signutils from "../../common/signatures";

type DraftContractInput = {
	initiator: "sender" | "receiver";
	senderPubkey: string;
	receiverPubkey: string;
	amount: number;
	requestId: string;
};

type ContractQueryFilter = {
	status?: ContractStatus;
	side?: DraftContractInput["initiator"];
};

@Injectable()
export class EscrowsContractsService {
	private readonly logger = new Logger(EscrowsContractsService.name);
	private readonly arbitratorPublicKey: string;

	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(EscrowContract)
		private readonly contractRepository: Repository<EscrowContract>,
		@InjectRepository(ContractExecution)
		private readonly contractExecutionRepository: Repository<ContractExecution>,
		private readonly arkService: ArkService,
		private readonly events: EventEmitter2,
	) {
		const arbitratorPubKey =
			this.configService.get<string>("ARBITRATOR_PUB_KEY");
		if (!arbitratorPubKey) {
			throw new Error("ARBITRATOR_PUB_KEY is not set");
		}
		this.logger.log(`ARBITRATOR_PUB_KEY=${arbitratorPubKey}`);
		this.arbitratorPublicKey = arbitratorPubKey;
	}

	async onModuleInit() {
		const qb = this.contractRepository.createQueryBuilder("r").where(
			new Brackets((w) => {
				w.where("r.status in ('created','funded')");
			}),
		);
		const contractsWaitingForFunding = await qb
			.where("r.status in ('created','funded')")
			.andWhere("r.arkAddress IS NOT NULL")
			.getMany();
		setTimeout(() => {
			contractsWaitingForFunding.forEach((entity) => {
				this.events.emit(CONTRACT_CREATED_ID, {
					eventId: randomUUID(),
					contractId: entity.externalId,
					// biome-ignore lint/style/noNonNullAssertion: checked in the query
					arkAddress: ArkAddress.decode(entity.arkAddress!),
					createdAt: entity.createdAt.toISOString(),
				} satisfies ContractCreated);
			});
		}, 5000);
	}

	async createDraftContract(
		input: DraftContractInput,
	): Promise<DraftEscrowContractOutDto> {
		if (input.senderPubkey === this.arbitratorPublicKey) {
			throw new Error("Cannot create a contract with the arbitrator as sender");
		}
		if (input.receiverPubkey === this.arbitratorPublicKey) {
			throw new Error(
				"Cannot create a contract with the arbitrator as receiver",
			);
		}
		const entity = this.contractRepository.create({
			externalId: nanoid(16),
			request: { externalId: input.requestId } as Pick<
				EscrowRequest,
				"externalId"
			>,
			status: "draft",
			senderPubkey: input.senderPubkey,
			receiverPubkey: input.receiverPubkey,
			amount: input.amount ?? 0,
		});
		this.events.emit(CONTRACT_DRAFTED_ID, {
			eventId: randomUUID(),
			contractId: entity.externalId,
			senderPubkey: input.senderPubkey,
			receiverPubkey: input.receiverPubkey,
			createdAt: new Date().toISOString(),
		} satisfies ContractDrafted);
		const persisted = await this.contractRepository.save(entity);
		return {
			externalId: persisted.externalId,
			requestId: persisted.request.externalId,
			senderPublicKey: persisted.senderPubkey,
			receiverPublicKey: persisted.receiverPubkey,
			amount: persisted.amount,
			status: persisted.status,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
		};
	}

	async acceptDraftContract(
		externalId: string,
		acceptorPubkey: string,
	): Promise<GetEscrowContractDto> {
		const draft = await this.contractRepository.findOne({
			where: { externalId },
		});
		if (!draft) {
			throw new NotFoundException(`Contract ${externalId} not found`);
		}
		// if (draft.status !== "draft" || draft.status !== "funded") {
		// 	throw new UnprocessableEntityException(
		// 		`Contract ${externalId} is not in draft status`,
		// 	);
		// }
		if (acceptorPubkey === this.arbitratorPublicKey) {
			throw new ForbiddenException(
				"Cannot create a contract with the arbitrator as sender",
			);
		}
		// if (
		// 	acceptorPubkey !== draft.senderPubkey ||
		// 	acceptorPubkey !== draft.receiverPubkey
		// ) {
		// 	throw new ForbiddenException(
		// 		"Only the sender or receiver can accept the contract",
		// 	);
		// }

		this.logger.debug(
			`Creating contract from draft ${draft.externalId} with acceptor ${acceptorPubkey}`,
		);

		const arkAddress = this.arkService.createArkAddressForContract({
			senderPublicKey: draft.senderPubkey,
			receiverPublicKey: draft.receiverPubkey,
			arbitratorPublicKey: this.arbitratorPublicKey,
			contractNonce: `${draft.externalId}${draft.request.externalId}`,
		});

		await this.contractRepository.update(
			{ externalId: draft.externalId },
			{
				status: "created",
				arkAddress: arkAddress.encode(),
				acceptedAt: new Date(),
			},
		);

		this.events.emit(CONTRACT_CREATED_ID, {
			eventId: randomUUID(),
			contractId: draft.externalId,
			arkAddress,
			createdAt: new Date().toISOString(),
		} satisfies ContractCreated);

		const persisted = await this.contractRepository.findOne({
			where: { externalId: draft.externalId },
		});
		if (!persisted) {
			throw new InternalServerErrorException("Contract not found after update");
		}
		return {
			externalId: persisted.externalId,
			requestId: persisted.request.externalId,
			senderPublicKey: persisted.senderPubkey,
			receiverPublicKey: persisted.receiverPubkey,
			amount: persisted.amount,
			side: persisted.request.side,
			description: persisted.request.description,
			arkAddress: persisted.arkAddress,
			status: persisted.status,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
		};
	}

	static isContractParty(pubkey: string, contract: EscrowContract): boolean {
		return (
			pubkey === contract.senderPubkey || pubkey === contract.receiverPubkey
		);
	}

	static isSender(pubkey: string, contract: EscrowContract): boolean {
		return pubkey === contract.senderPubkey;
	}

	async rejectDraftContract({
		externalId,
		rejectorPubkey,
		reason,
	}: {
		externalId: string;
		rejectorPubkey: string;
		reason: string;
	}): Promise<GetEscrowContractDto> {
		const draft = await this.getOneForPartyAndStatus(
			externalId,
			rejectorPubkey,
			"draft",
		);

		if (!draft) {
			throw new NotFoundException(
				`Contract ${externalId} with status 'draft' not found for ${rejectorPubkey}`,
			);
		}

		const isCreator = this.isContractCreator(rejectorPubkey, draft);

		await this.contractRepository.update(
			{ externalId: draft.externalId },
			{
				status: isCreator ? "canceled-by-creator" : "rejected-by-counterparty",
				cancelationReason: reason,
			},
		);

		this.events.emit(CONTRACT_VOIDED_ID, {
			eventId: randomUUID(),
			contractId: draft.externalId,
			// there shouldn't be an arkAddress here
			arkAddress: draft.arkAddress
				? ArkAddress.decode(draft.arkAddress)
				: undefined,
			reason,
			voidedAt: new Date().toISOString(),
		} satisfies ContractVoided);

		const persisted = await this.contractRepository.findOne({
			where: { externalId: draft.externalId },
		});
		if (!persisted) {
			throw new InternalServerErrorException("Contract not found after update");
		}
		return {
			externalId: persisted.externalId,
			requestId: persisted.request.externalId,
			senderPublicKey: persisted.senderPubkey,
			receiverPublicKey: persisted.receiverPubkey,
			amount: persisted.amount,
			side: persisted.request.side,
			description: persisted.request.description,
			arkAddress: persisted.arkAddress,
			status: persisted.status,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
		};
	}

	/*
	 * Cursor is base64(`${createdAtMs}:${id}`).
	 * Returns the current page and the nextCursor (if more items exist), plus total public items.
	 */
	async getByUser(
		pubKey: string,
		filter: ContractQueryFilter,
		limit: number,
		cursor: Cursor = emptyCursor,
	): Promise<{
		items: GetEscrowContractDto[];
		nextCursor?: string;
		total: number;
	}> {
		const take = Math.min(limit, 100);

		const filteredBrackets = new Brackets((w) => {
			if (filter?.side !== undefined) {
				if (filter.side === "sender") {
					w.where("r.senderPubkey = :pubKey", { pubKey });
				} else {
					w.where("r.receiverPubkey = :pubKey", { pubKey });
				}
			} else {
				w.where("r.senderPubkey = :pubKey", { pubKey }).orWhere(
					"r.receiverPubkey = :pubKey",
					{ pubKey },
				);
			}
		});

		const qb = this.contractRepository
			.createQueryBuilder("r")
			.where(filteredBrackets);

		qb.leftJoinAndSelect("r.request", "request");

		// apply  filters if provided
		if (filter?.status) {
			qb.andWhere("r.status = :status", { status: filter.status });
		}

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

		// total respecting the same filters (including status/side if present)
		const totalQb = this.contractRepository
			.createQueryBuilder("r")
			.leftJoin("r.request", "request")
			.where(filteredBrackets);

		if (filter?.status) {
			totalQb.andWhere("r.status = :status", { status: filter.status });
		}

		const total = await totalQb.getCount();

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}
		const items: GetEscrowContractDto[] = rows.map((r) => ({
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
			balance: r.virtualCoins?.reduce((a, _) => a + _.value, 0) ?? 0,
			createdAt: r.createdAt.getTime(),
			updatedAt: r.updatedAt.getTime(),
		}));

		return { items, nextCursor, total };
	}

	async signContractExecution(
		contractId: string,
		executionId: string,
		signerPubKey: PublicKey,
		signature: {
			arkTx: string;
			checkpoints: string[];
		},
	): Promise<GetExecutionByContractDto> {
		const contract = await this.getOneForPartyAndStatus(
			contractId,
			signerPubKey,
			["pending-execution", "under-arbitration"],
		);
		const execution = await this.contractExecutionRepository.findOne({
			where: { externalId: executionId, contract: { externalId: contractId } },
		});
		if (!contract || !execution) {
			throw new NotFoundException(
				`Contract ${contractId} or execution ${executionId} not found`,
			);
		}
		if (execution.status === "pending-server-confirmation") {
			throw new InternalServerErrorException(
				"Execution in pending-server-confirmation",
			);
		}
		if (execution.cleanTransaction.approvedByPubKeys.includes(signerPubKey)) {
			throw new ConflictException("Signer has already signed");
		}
		if (execution.cleanTransaction.rejectedByPubKeys.includes(signerPubKey)) {
			throw new ConflictException("Signer has already rejected");
		}
		const requiredPubkeys = execution.cleanTransaction.requiredSigners.flatMap(
			(s) => {
				switch (s) {
					case "sender":
						return [contract.senderPubkey];
					case "receiver":
						return [contract.receiverPubkey];
					default:
						return [];
				}
			},
		);
		if (!requiredPubkeys.includes(signerPubKey)) {
			throw new ConflictException("Signer is not a required signer");
		}

		try {
			this.logger.debug("verifying tapscript signatures");
			const txBytes = base64.decode(signature.arkTx);
			const tx = Transaction.fromPSBT(txBytes, { allowUnknown: true });
			verifyTapscriptSignatures(tx, 0, [signerPubKey]);
			this.logger.debug("OK tapscript signatures");
		} catch (e) {
			this.logger.error(e);
			throw new BadRequestException("Invalid signature");
		}

		const signerIsInitiator = execution.initiatedByPubKey === signerPubKey;
		let nextExecutionStatus: ExecutionStatus = execution.status;

		switch (execution.status) {
			case "pending-initiator-signature": {
				this.logger.debug(
					`execution ${executionId} is pending-initiator-signature, signer is ${signerIsInitiator ? "initiator" : "counterparty"}`,
				);
				if (!signerIsInitiator) {
					throw new ForbiddenException(
						`Execution must be signed by initiator first`,
					);
				}
				nextExecutionStatus = "pending-counterparty-signature";
				break;
			}
			case "pending-counterparty-signature": {
				this.logger.debug(
					`execution ${executionId} is pending-counterparty-signature, signer is ${signerIsInitiator ? "initiator" : "counterparty"}`,
				);
				if (signerIsInitiator) {
					throw new ForbiddenException(
						`Execution must be signed by counterparty`,
					);
				}
				nextExecutionStatus = "pending-server-confirmation";
				break;
			}
			default: {
				throw new UnprocessableEntityException(
					`Execution ${executionId} is not pending any signature`,
				);
			}
		}

		this.logger.debug(
			`execution ${executionId} moving from ${execution.status} to ${nextExecutionStatus} by ${execution.initiatedByPubKey === signerPubKey ? "initiator" : "counterparty"}`,
		);

		const cleanTransaction: ExecutionTransaction = {
			...execution.cleanTransaction,
			approvedByPubKeys: [
				signerPubKey,
				...execution.cleanTransaction.approvedByPubKeys,
			],
		};

		const signedTransaction = {
			arkTx: execution.signedTransaction
				? base64.encode(
						signutils
							.mergeTx(signature.arkTx, execution.signedTransaction.arkTx)
							.toPSBT(),
					)
				: signature.arkTx,
			checkpoints: execution.signedTransaction
				? signutils
						.mergeCheckpoints(
							signature.checkpoints,
							execution.signedTransaction.checkpoints,
						)
						.map((_) => base64.encode(_.toPSBT()))
				: signature.checkpoints,
		};

		await this.contractExecutionRepository.update(
			{
				externalId: executionId,
				contract: { externalId: contractId },
			},
			{
				status: nextExecutionStatus,
				cleanTransaction: cleanTransaction,
				signedTransaction,
			},
		);

		if (nextExecutionStatus === "pending-server-confirmation") {
			this.logger.debug(
				`execution ${executionId} is pending-server-confirmation`,
			);
			const finalTxId = await this.submitAndFinalizeExecutionTransaction({
				signedTx: signedTransaction.arkTx,
				signedCheckpoints: signedTransaction.checkpoints,
				requiredSigners: cleanTransaction.requiredSigners,
				contractId,
				executionId,
			});
			this.logger.debug(
				`execution ${executionId} successfully submitted to ark with txid ${finalTxId}`,
			);
		}

		const persisted = await this.contractExecutionRepository.findOne({
			where: {
				externalId: executionId,
				contract: { externalId: contractId },
			},
		});
		if (!persisted) {
			throw new InternalServerErrorException(
				"Execution not found after update",
			);
		}
		if (!contract.arkAddress) {
			throw new InternalServerErrorException(
				`Contract ${contractId} has no arkAddress`,
			);
		}
		this.events.emit(CONTRACT_EXECUTED_ID, {
			eventId: randomUUID(),
			contractId,
			arkAddress: ArkAddress.decode(contract.arkAddress),
			executedAt: new Date().toISOString(),
		} satisfies ContractExecuted);
		return {
			externalId: persisted.externalId,
			initiatedByPubKey: persisted.initiatedByPubKey,
			status: persisted.status,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
			transaction: persisted.cleanTransaction,
		};
	}

	private async submitAndFinalizeExecutionTransaction(input: {
		// Base64 encoded PSBT
		signedTx: string;
		// Base64 encoded PSBT
		signedCheckpoints: string[];
		requiredSigners: Signers[];
		contractId: string;
		executionId: string;
	}) {
		const execution = await this.contractExecutionRepository.findOne({
			where: {
				externalId: input.executionId,
				contract: { externalId: input.contractId },
			},
		});
		if (!execution) {
			return new NotFoundException(
				`contract execution ${input.executionId} not found`,
			);
		}
		if (!execution.signedTransaction) {
			return new InternalServerErrorException(
				`Execution ${input.executionId} has no signedTransaction`,
			);
		}

		const signedTransaction = {
			arkTx: input.signedTx,
			checkpoints: input.signedCheckpoints,
			// signutils
			// 	.mergeCheckpoints(
			// 		input.signedCheckpoints,
			// 		execution.signedTransaction.checkpoints,
			// 	)
			// 	.map((_) => base64.encode(_.toPSBT())),
		};

		const finalTxId = await this.arkService.executeEscrowTransaction({
			cleanTransaction: execution.cleanTransaction,
			signedTransaction,
		});

		await this.contractRepository.update(
			{ externalId: input.contractId },
			{ status: "completed" },
		);
		await this.contractExecutionRepository.update(
			{
				externalId: input.executionId,
				contract: { externalId: input.contractId },
			},
			{
				status: "executed",
				arkServerData: { finalTxId },
			},
		);
		return finalTxId;
	}

	async createDirectSettlementExecution(
		externalId: string,
		initiatorArkAddress: string,
		initiatorPubKey: string,
	): Promise<ExecuteEscrowContractOutDto> {
		const contract = await this.getOneForPartyAndStatus(
			externalId,
			initiatorPubKey,
			"funded",
		);
		if (!contract) {
			throw new NotFoundException(
				`Contract ${externalId} with status 'funded' not found for ${initiatorPubKey}`,
			);
		}
		if (!contract.virtualCoins || contract.virtualCoins.length === 0) {
			throw new UnprocessableEntityException("Contract  is not funded");
		}
		if (contract.receiverPubkey !== initiatorPubKey) {
			throw new ForbiddenException("Only the receiver can execute this action");
		}
		const vtxo = contract.virtualCoins[0];
		try {
			const escrowTransaction = await this.arkService.createEscrowTransaction(
				{
					action: "direct-settle",
					receiverAddress: ArkAddress.decode(initiatorArkAddress),
					receiverPublicKey: initiatorPubKey,
					senderPublicKey: contract.senderPubkey,
					arbitratorPublicKey: this.arbitratorPublicKey,
					contractNonce: `${contract.externalId}${contract.request.externalId}`,
				},
				vtxo,
			);

			const entity = this.contractExecutionRepository.create({
				action: "direct-settle",
				externalId: nanoid(16),
				contract: { externalId: contract.externalId } as Pick<
					EscrowContract,
					"externalId"
				>,
				initiatedByPubKey: initiatorPubKey,
				status: "pending-initiator-signature",
				cleanTransaction: {
					vtxo: {
						txid: vtxo.txid,
						vout: vtxo.vout,
						value: vtxo.value,
					},
					arkTx: escrowTransaction.arkTx,
					checkpoints: escrowTransaction.checkpoints,
					requiredSigners: escrowTransaction.requiredSigners,
					approvedByPubKeys: [],
					rejectedByPubKeys: [],
				},
			});
			const persisted = await this.contractExecutionRepository.save(entity);
			await this.contractRepository.update(
				{ externalId: contract.externalId },
				{
					status: "pending-execution",
				},
			);
			return {
				externalId: persisted.externalId,
				contractId: persisted.contract.externalId,
				arkTx: persisted.cleanTransaction.arkTx,
				checkpoints: persisted.cleanTransaction.checkpoints,
				vtxo: persisted.cleanTransaction.vtxo,
			};
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

	async getOneByExternalId(
		externalId: string,
		pubKey: string,
	): Promise<GetEscrowContractDto> {
		const contract = await this.contractRepository.findOne({
			where: { externalId },
		});
		if (contract === null) {
			throw new NotFoundException(
				`Contract ${externalId} not found for ${pubKey}`,
			);
		}
		if (
			contract?.senderPubkey !== pubKey &&
			contract?.receiverPubkey !== pubKey
		) {
			throw new ForbiddenException("Not allowed to access this contract");
		}

		return {
			externalId: contract.externalId,
			requestId: contract.request.externalId,
			senderPublicKey: contract.senderPubkey,
			receiverPublicKey: contract.receiverPubkey,
			amount: contract.amount,
			arkAddress: contract.arkAddress,
			status: contract.status,
			side: contract.request.side,
			description: contract.request.description,
			cancelationReason: contract.cancelationReason,
			virtualCoins: contract.virtualCoins,
			createdAt: contract.createdAt.getTime(),
			updatedAt: contract.updatedAt.getTime(),
		};
	}

	async getAllExecutionsByContractId(
		contractId: string,
		pubKey: string,
	): Promise<GetExecutionByContractDto[]> {
		const contract = await this.getOneForPartyAndStatus(contractId, pubKey);
		if (contract === null) {
			throw new NotFoundException(
				`Contract ${contractId} not found for ${pubKey}`,
			);
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
			transaction: e.cleanTransaction,
			createdAt: e.createdAt.getTime(),
			updatedAt: e.updatedAt.getTime(),
		}));
	}

	private getOneForPartyAndStatus(
		contractId: string,
		party: PublicKey,
		status?: ContractStatus | ContractStatus[],
	): Promise<EscrowContract | null> {
		const qb = this.contractRepository
			.createQueryBuilder("c")
			.leftJoinAndSelect("c.request", "request")
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

	private isContractCreator(
		pubkey: PublicKey,
		contract: EscrowContract,
	): boolean {
		// The creator of the request is always the counterparty of the contract
		return pubkey !== contract.request.creatorPubkey;
	}
}
