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
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import {
	ArkAddress,
	verifyTapscriptSignatures,
	VirtualCoin,
} from "@arkade-os/sdk";
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
	CONTRACT_UPDATED_ID,
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
import { ActionType } from "../../common/Action.type";
import { Contract } from "../../common/Contract.type";
import { UpdateContractDto } from "./dto/update-contract.dto";

type DraftContractInput = {
	initiator: "sender" | "receiver";
	senderPubkey: string;
	receiverPubkey: string;
	receiverAddress?: string;
	amount: number;
	requestId: string;
	description: string;
	side: string;
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
					eventId: nanoid(4),
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
			receiverAddress: input.receiverAddress,
			amount: input.amount ?? 0,
			createdBy: input.initiator,
		});
		this.events.emit(CONTRACT_DRAFTED_ID, {
			eventId: nanoid(4),
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
			createdBy: input.initiator,
			amount: persisted.amount,
			status: persisted.status,
			description: input.description,
			side: input.initiator,
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
		if (draft.status !== "draft") {
			throw new UnprocessableEntityException(
				`Contract ${externalId} is not in draft status`,
			);
		}
		if (
			acceptorPubkey !== draft.senderPubkey &&
			acceptorPubkey !== draft.receiverPubkey
		) {
			throw new ForbiddenException(
				"Only the sender or receiver can accept the contract",
			);
		}
		if (
			(acceptorPubkey === draft.senderPubkey && draft.createdBy === "sender") ||
			(acceptorPubkey === draft.receiverPubkey &&
				draft.createdBy === "receiver")
		) {
			throw new ForbiddenException(
				"Only the counterparty can accept the contract - you created this draft contract",
			);
		}

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
			eventId: nanoid(4),
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
			createdBy: persisted.createdBy,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
		};
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

		if (this.isContractCreator(rejectorPubkey, draft)) {
			throw new ForbiddenException(
				`Only the counterparty can reject a draft contract`,
			);
		}

		await this.contractRepository.update(
			{ externalId: draft.externalId },
			{
				status: "rejected-by-counterparty",
				cancelationReason: reason,
			},
		);

		this.events.emit(CONTRACT_VOIDED_ID, {
			eventId: nanoid(4),
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
			createdBy: persisted.createdBy,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
		};
	}

	async cancelDraftContract({
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

		if (!this.isContractCreator(rejectorPubkey, draft)) {
			throw new ForbiddenException(
				`Only the creator can cancel a draft contract`,
			);
		}

		await this.contractRepository.update(
			{ externalId: draft.externalId },
			{
				status: "canceled-by-creator",
				cancelationReason: reason,
			},
		);

		this.events.emit(CONTRACT_VOIDED_ID, {
			eventId: nanoid(4),
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
			createdBy: persisted.createdBy,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
		};
	}

	async recedFromContract({
		externalId,
		rejectorPubkey,
		reason,
	}: {
		externalId: string;
		rejectorPubkey: string;
		reason: string;
	}): Promise<GetEscrowContractDto> {
		const created = await this.getOneForPartyAndStatus(
			externalId,
			rejectorPubkey,
			"created",
		);

		if (!created || !created.arkAddress) {
			throw new NotFoundException(
				`Contract ${externalId} with status 'created' not found for ${rejectorPubkey}`,
			);
		}

		const coins = await this.arkService.getSpendableVtxoForContract(
			ArkAddress.decode(created.arkAddress),
		);

		if (coins.length > 0) {
			throw new ForbiddenException(
				`Contract ${externalId} is funded, cannot reced from it`,
			);
		}

		const isCreator = this.isContractCreator(rejectorPubkey, created);

		await this.contractRepository.update(
			{ externalId: created.externalId },
			{
				status: isCreator
					? "rescinded-by-creator"
					: "rescinded-by-counterparty",
				cancelationReason: reason,
			},
		);

		this.events.emit(CONTRACT_VOIDED_ID, {
			eventId: nanoid(4),
			contractId: created.externalId,
			// there shouldn't be an arkAddress here
			arkAddress: created.arkAddress
				? ArkAddress.decode(created.arkAddress)
				: undefined,
			reason,
			voidedAt: new Date().toISOString(),
		} satisfies ContractVoided);

		const persisted = await this.contractRepository.findOne({
			where: { externalId: created.externalId },
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
			createdBy: persisted.createdBy,
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
			createdBy: r.createdBy,
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
		if (execution.status !== "pending-signatures") {
			throw new ForbiddenException(
				`Cannot sign an execution with status ${execution.status}`,
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

		const cleanTransaction: ExecutionTransaction = {
			...execution.cleanTransaction,
			approvedByPubKeys: [
				signerPubKey,
				...execution.cleanTransaction.approvedByPubKeys,
			],
		};

		const nextExecutionStatus: ExecutionStatus = this.isExecutionSignedByAll(
			cleanTransaction,
		)
			? "pending-server-confirmation"
			: "pending-signatures";

		this.logger.debug(
			`execution ${executionId} moving from ${execution.status} to ${nextExecutionStatus}`,
		);

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

		// backup if finalization fails
		const rollbackToStatus = execution.status;
		const rollbackToCleanTransaction = execution.cleanTransaction;
		const rollbackToSignedTransaction = execution.signedTransaction;

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
			try {
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
			} catch (e) {
				this.logger.error("Failed to submit execution to ark, rollback", e);
				await this.contractExecutionRepository.update(
					{
						externalId: executionId,
						contract: { externalId: contractId },
					},
					{
						status: rollbackToStatus,
						cleanTransaction: rollbackToCleanTransaction,
						signedTransaction: rollbackToSignedTransaction,
					},
				);
				throw new InternalServerErrorException(
					"Failed to submit execution to ark provider",
					{ cause: e },
				);
			}
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
			eventId: nanoid(4),
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

	private isExecutionSignedByAll(extx: ExecutionTransaction): boolean {
		return (
			extx.approvedByPubKeys.length ===
			extx.requiredSigners.filter((s) => s === "sender" || s === "receiver")
				.length
		);
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

	/**
	 * Used by the receiver to create a direct settlement execution with a specific receiver address.
	 * The contract must be in "funded" status and the initiator must be the receiver.
	 *
	 * @param externalId contract externalId
	 * @param receiverAddress where the funds will be sent upon execution
	 * @param initiatorPubKey
	 */
	async createDirectSettlementExecutionWithAddress(
		externalId: string,
		receiverAddress: string,
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
			throw new ForbiddenException(
				"Only the receiver can initiate a direct settlement execution",
			);
		}

		try {
			const execution = await this.createDirectSettlementExecution(
				contract,
				receiverAddress,
				initiatorPubKey,
			);
			await this.contractRepository.update(
				{ externalId: contract.externalId },
				{
					status: "pending-execution",
				},
			);
			return {
				externalId: execution.externalId,
				contractId: execution.contract.externalId,
				arkTx: execution.cleanTransaction.arkTx,
				checkpoints: execution.cleanTransaction.checkpoints,
				vtxo: execution.cleanTransaction.vtxo,
			};
		} catch (e) {
			this.logger.error("Failed to create direct settlement execution", e);
			throw new InternalServerErrorException(
				"Failed to create direct settlement execution",
				{ cause: e },
			);
		}
	}

	private async createDirectSettlementExecution(
		contract: EscrowContract,
		receiverAddress: string,
		initiatorPubKey: string,
		vtxos?: VirtualCoin[],
	): Promise<ContractExecution> {
		const vtxo = (vtxos ?? contract.virtualCoins)?.[0];
		if (vtxo === undefined) {
			throw new Error("Not VTXO found for contract");
		}
		const action: ActionType = "direct-settle";
		try {
			const escrowTransaction = await this.arkService.createEscrowTransaction(
				{
					action,
					receiverAddress: ArkAddress.decode(receiverAddress),
					receiverPublicKey: contract.receiverPubkey,
					senderPublicKey: contract.senderPubkey,
					arbitratorPublicKey: this.arbitratorPublicKey,
					contractNonce: `${contract.externalId}${contract.request.externalId}`,
				},
				vtxo,
			);

			const entity = this.contractExecutionRepository.create({
				action,
				externalId: nanoid(16),
				contract: { externalId: contract.externalId } as Pick<
					EscrowContract,
					"externalId"
				>,
				initiatedByPubKey: initiatorPubKey,
				status: "pending-signatures",
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
			return await this.contractExecutionRepository.save(entity);
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
		if (contract.receiverAddress) {
			// if there is a receiver address, we create a direct settlement execution automatically
			try {
				const execution = await this.createDirectSettlementExecution(
					contract,
					contract.receiverAddress,
					this.arbitratorPublicKey,
					evt.vtxos,
				);
				this.logger.debug(
					`Direct settlement execution ${execution.externalId} created automatically for contract ${contract.externalId}`,
				);
				await this.contractRepository.update(
					{ externalId: contract.externalId },
					{
						status: "pending-execution",
						virtualCoins: evt.vtxos,
					},
				);
			} catch (e) {
				this.logger.error(
					`Failed to create direct settlement execution automatically for contract ${contract.externalId}`,
					e,
				);
			}
		} else {
			await this.contractRepository.update(
				{ externalId: contract.externalId },
				{
					status: "funded",
					virtualCoins: evt.vtxos,
				},
			);
		}
	}

	async updateOneByExternalId(
		externalId: string,
		pubkey: string,
		update: UpdateContractDto,
	): Promise<GetEscrowContractDto> {
		const contract = await this.getOneForPartyAndStatus(externalId, pubkey, [
			"draft",
			"created",
			"funded",
		]);
		if (!contract) {
			throw new NotFoundException(`Contract ${externalId} not found`);
		}
		if (update.releaseAddress) {
			if (pubkey !== contract.receiverPubkey) {
				throw new ForbiddenException(
					"Only receiver can update release address",
				);
			}
			try {
				ArkAddress.decode(update.releaseAddress);
			} catch (e) {
				throw new BadRequestException("Invalid release address");
			}
			await this.contractRepository.update(
				{ externalId },
				{ ...contract, receiverAddress: update.releaseAddress },
			);
			console.log("contract updated!");
			this.events.emit(CONTRACT_UPDATED_ID, {
				eventId: nanoid(4),
				contractId: externalId,
				releaseAddress: update.releaseAddress,
			});
			return await this.getOneByExternalId(externalId, pubkey);
		}
		throw new BadRequestException("Nothing to update");
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
			receiverAddress: contract.receiverAddress,
			amount: contract.amount,
			arkAddress: contract.arkAddress,
			status: contract.status,
			side: contract.request.side,
			description: contract.request.description,
			cancelationReason: contract.cancelationReason,
			virtualCoins: contract.virtualCoins,
			createdBy: contract.createdBy,
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
