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
import { randomUUID } from "node:crypto";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { ArkAddress, VirtualCoin } from "@arkade-os/sdk";
import { Transaction } from "@scure/btc-signer";
import { hex } from "@scure/base";

import { ArkService, EscrowTransaction } from "../../ark/ark.service";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { EscrowContract } from "./escrow-contract.entity";
import {
	CONTRACT_CREATED_ID,
	CONTRACT_DRAFTED_ID,
	CONTRACT_FUNDED_ID,
	ContractCreated,
	ContractDrafted,
	ContractFunded,
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
	ExecutionTransaction,
} from "./contract-execution.entity";
import { GetExecutionByContractDto } from "./dto/get-execution-by-contract";

import { DraftEscrowContractOutDto } from "./dto/create-escrow-contract.dto";

type DraftContractInput = {
	initiator: "sender" | "receiver";
	senderPubkey: string;
	receiverPubkey: string;
	amount: number;
	requestId: string;
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
		if (draft.status !== "draft") {
			throw new UnprocessableEntityException(
				`Contract ${externalId} is not in draft status`,
			);
		}
		if (acceptorPubkey === this.arbitratorPublicKey) {
			throw new ForbiddenException(
				"Cannot create a contract with the arbitrator as sender",
			);
		}
		if (
			acceptorPubkey !== draft.senderPubkey ||
			acceptorPubkey !== draft.receiverPubkey
		) {
			throw new ForbiddenException(
				"Only the sender or receiver can accept the contract",
			);
		}

		this.logger.debug(
			`Creating contract from draft ${draft.externalId} with acceptor ${acceptorPubkey}`,
		);

		const arkAddress = this.arkService.createArkAddressForContract({
			senderPublicKey: draft.senderPubkey,
			receiverPublicKey: draft.receiverPubkey,
			arbitratorPublicKey: this.arbitratorPublicKey,
		});

		await this.contractRepository.update(
			{ externalId: draft.externalId },
			{
				status: "created",
				arkAddress: arkAddress.encode(),
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
			arkAddress: persisted.arkAddress,
			status: persisted.status,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
		};
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
			senderPublicKey: r.senderPubkey,
			receiverPublicKey: r.receiverPubkey,
			amount: r.amount,
			status: r.status,
			balance: r.virtualCoins?.reduce((a, _) => a + _.value, 0) ?? 0,
			createdAt: r.createdAt.getTime(),
			updatedAt: r.updatedAt.getTime(),
		}));

		return { items, nextCursor, total };
	}

	async signContractExecution(
		contractId: string,
		executionId: string,
		signerPubKey: string,
		signature: {
			arkTx: string;
			checkpoints: string[];
		},
	): Promise<GetExecutionByContractDto> {
		const contract = await this.contractRepository.findOne({
			where: { externalId: contractId },
		});
		const execution = await this.contractExecutionRepository.findOne({
			where: { externalId: executionId, contract: { externalId: contractId } },
		});
		if (!contract || !execution) {
			throw new NotFoundException(
				`Contract ${contractId} or execution ${executionId} not found`,
			);
		}
		if (contract.status !== "funded") {
			throw new UnprocessableEntityException(
				`Contract ${contractId} is not funded`,
			);
		}
		if (!execution.transaction.requiredSignersPubKeys.includes(signerPubKey)) {
			throw new ConflictException("Signer is not a required signer");
		}
		if (execution.transaction.approvedByPubKeys.includes(signerPubKey)) {
			throw new ConflictException("Signer has already approved");
		}
		if (execution.transaction.rejectedByPubKeys.includes(signerPubKey)) {
			throw new ConflictException("Signer has already rejected");
		}

		// Verify the signed PSBTs actually match the original tx skeleton
		// and include a signature by signerPubKey
		this.verifyExecutionSignature(execution, signerPubKey, {
			arkTx: hex.decode(signature.arkTx),
			checkpoints: signature.checkpoints.map(hex.decode),
		});

		const updatedExcutionTx: ExecutionTransaction = {
			...execution.transaction,
			arkTx: signature.arkTx,
			checkpoints: signature.checkpoints,
			approvedByPubKeys: [signerPubKey],
		};

		let nextExecutionStatus = execution.status;

		switch (execution.status) {
			case "pending-initiator-signature": {
				if (execution.initiatedByPubKey !== signerPubKey) {
					throw new ForbiddenException(
						`Execution must be signed by initiator first`,
					);
				}
				nextExecutionStatus = "pending-counterparty-signature";
				break;
			}
			case "pending-counterparty-signature": {
				if (execution.initiatedByPubKey === signerPubKey) {
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

		// TODO:  send to ARK network

		await this.contractExecutionRepository.update(
			{
				externalId: contract.externalId,
				contract: { externalId: contractId },
			},
			{
				status: nextExecutionStatus,
				transaction: updatedExcutionTx,
			},
		);

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
		return {
			...persisted,
			createdAt: persisted.createdAt.getTime(),
			updatedAt: persisted.updatedAt.getTime(),
		};
	}

	async createDirectSettlementExecution(
		externalId: string,
		initiatorArkAddress: string,
		initiatorPubKey: string,
	): Promise<ExecuteEscrowContractOutDto> {
		const contract = await this.contractRepository.findOne({
			where: { externalId },
		});
		if (!contract) {
			throw new NotFoundException(`Contract ${externalId} not found`);
		}
		if (contract.status === "draft") {
			throw new UnprocessableEntityException(
				"Contract is still in draft or addresses are not set",
			);
		}
		if (
			contract.status !== "funded" ||
			!contract.virtualCoins ||
			contract.virtualCoins.length === 0
		) {
			throw new UnprocessableEntityException("Contract  is not funded");
		}
		if (contract.receiverPubkey !== initiatorPubKey) {
			throw new ForbiddenException("Only the receiver can execute this action");
		}
		const vtxo = contract.virtualCoins[0];
		if (!vtxo) {
			throw new UnprocessableEntityException("no vtxo found");
		}
		this.logger.debug(
			`Contract ${contract.externalId} direct settlement using vtxo ${vtxo.txid} value ${vtxo.value}`,
		);
		try {
			const escrowTransaction = await this.arkService.createEscrowTransaction(
				{
					action: "direct-settle",
					receiverAddress: ArkAddress.decode(initiatorArkAddress),
					receiverPublicKey: initiatorPubKey,
					senderPublicKey: contract.senderPubkey,
					arbitratorPublicKey: this.arbitratorPublicKey,
				},
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
					arkTx: hex.encode(escrowTransaction.arkTx.toPSBT()),
					checkpoints: escrowTransaction.checkpoints.map((_) =>
						hex.encode(_.toPSBT()),
					),
					requiredSignersPubKeys: escrowTransaction.requiredSigners,
					approvedByPubKeys: [],
					rejectedByPubKeys: [],
				},
			});
			const persisted = await this.contractExecutionRepository.save(entity);
			return {
				externalId: persisted.externalId,
				contractId: persisted.contract.externalId,
				arkTx: persisted.transaction.arkTx,
				checkpoints: persisted.transaction.checkpoints,
				vtxo: persisted.transaction.vtxo,
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
			senderPublicKey: contract.senderPubkey,
			receiverPublicKey: contract.receiverPubkey,
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
	): Promise<GetExecutionByContractDto[]> {
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

	private verifyExecutionSignature(
		execution: ContractExecution,
		signerPubKey: string,
		signed: { arkTx: Uint8Array; checkpoints: Uint8Array[] },
	) {
		try {
			// signer must be one of the required signers for this execution
			if (
				!execution.transaction.requiredSignersPubKeys.includes(signerPubKey)
			) {
				throw new ConflictException("Signer is not a required signer");
			}

			// Parse unsigned/signed arkTx
			const unsignedArkTx = Transaction.fromPSBT(
				Uint8Array.from(execution.transaction.arkTx),
			);
			const signedArkTx = Transaction.fromPSBT(signed.arkTx);

			// Skeleton consistency
			if (!this.sameTxSkeleton(unsignedArkTx, signedArkTx)) {
				throw new UnprocessableEntityException(
					"Signed arkTx does not match the expected transaction",
				);
			}

			// Ensure signed arkTx includes any signature/finalization (witness/script)
			if (!this.txHasAnySignature(signedArkTx)) {
				throw new ConflictException("arkTx does not contain any signatures");
			}

			// Checkpoints: same length
			const unsignedCks = execution.transaction.checkpoints ?? [];
			if (unsignedCks.length !== signed.checkpoints.length) {
				throw new UnprocessableEntityException(
					"Checkpoint count does not match",
				);
			}

			for (let i = 0; i < unsignedCks.length; i++) {
				const u = Transaction.fromPSBT(Uint8Array.from(unsignedCks[i]));
				const s = Transaction.fromPSBT(signed.checkpoints[i]);

				if (!this.sameTxSkeleton(u, s)) {
					throw new UnprocessableEntityException(
						`Signed checkpoint #${i} does not match the expected transaction`,
					);
				}
				if (!this.txHasAnySignature(s)) {
					throw new ConflictException(
						`Checkpoint #${i} does not contain any signatures`,
					);
				}
			}
		} catch (e) {
			if (
				e instanceof ConflictException ||
				e instanceof UnprocessableEntityException
			) {
				throw e;
			}
			this.logger.error("Signature verification failed", e as Error);
			throw new UnprocessableEntityException("Invalid signature payload");
		}
	}

	/**
	 * Conservatively checks whether a transaction shows signs of being signed/finalized:
	 * - any input contains witness data
	 * - or any input contains scriptSig/final script data
	 *
	 * The exact properties depend on the Transaction object shape; we use optional checks.
	 */
	private txHasAnySignature(tx: Transaction): boolean {
		try {
			const inputs = (tx as any).getInputs?.() ?? (tx as any).inputs ?? [];
			for (const inp of inputs) {
				// Common encodings for signed/finalized inputs
				const witness: Uint8Array[] | undefined = (inp as any).witness;
				const finalScriptSig: Uint8Array | undefined = (inp as any).scriptSig;
				// Some implementations expose `finalScriptWitness` or similar
				const finalScriptWitness: Uint8Array[] | undefined = (inp as any)
					.finalScriptWitness;

				if (Array.isArray(witness) && witness.length > 0) return true;
				if (Array.isArray(finalScriptWitness) && finalScriptWitness.length > 0)
					return true;
				if (finalScriptSig instanceof Uint8Array && finalScriptSig.length > 0)
					return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Compares two transactions to ensure they are the same "skeleton":
	 * - same version, locktime (if applicable)
	 * - same number of inputs/outputs
	 * - each input has the same outpoint and sequence
	 * - each output has the same amount and script
	 */
	private sameTxSkeleton(a: Transaction, b: Transaction): boolean {
		try {
			if ((a as any).version !== (b as any).version) return false;
			if (((a as any).locktime ?? 0) !== ((b as any).locktime ?? 0))
				return false;

			const aIns = (a as any).getInputs?.() ?? (a as any).inputs ?? [];
			const bIns = (b as any).getInputs?.() ?? (b as any).inputs ?? [];
			const aOuts = (a as any).getOutputs?.() ?? (a as any).outputs ?? [];
			const bOuts = (b as any).getOutputs?.() ?? (b as any).outputs ?? [];

			if (aIns.length !== bIns.length) return false;
			if (aOuts.length !== bOuts.length) return false;

			for (let i = 0; i < aIns.length; i++) {
				const ai = aIns[i];
				const bi = bIns[i];
				if ((ai as any).txid !== (bi as any).txid) return false;
				if ((ai as any).vout !== (bi as any).vout) return false;
				if (
					((ai as any).sequence ?? 0xffffffff) !==
					((bi as any).sequence ?? 0xffffffff)
				)
					return false;
			}

			for (let i = 0; i < aOuts.length; i++) {
				const ao = aOuts[i];
				const bo = bOuts[i];
				// amount can be bigint/number depending on implementation
				const aAmt = BigInt((ao as any).amount);
				const bAmt = BigInt((bo as any).amount);
				if (aAmt !== bAmt) return false;

				const aScript = (ao as any).script as Uint8Array | undefined;
				const bScript = (bo as any).script as Uint8Array | undefined;
				if (!aScript || !bScript) return false;
				if (!this.equalBytes(aScript, bScript)) return false;
			}

			return true;
		} catch {
			return false;
		}
	}

	private equalBytes(a: Uint8Array, b: Uint8Array): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
		return true;
	}
}
