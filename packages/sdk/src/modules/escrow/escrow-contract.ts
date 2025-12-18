/**
 * Escrow Contract
 *
 * High-level escrow contract implementation using SDK primitives.
 * This is the main class developers interact with for escrow functionality.
 */

import { nanoid } from "nanoid";
import { ScriptBuilder, Party, XOnlyPubKey } from "../../core/index.js";
import {
	ContractStateMachine,
	ContractMetadata,
} from "../../contracts/index.js";
import { VtxoRef } from "../../transactions/index.js";
import { StorageAdapter, StoredContract } from "../../storage/index.js";
import { ProtocolProvider } from "../../protocol/index.js";
import {
	EscrowConfig,
	EscrowData,
	EscrowState,
	EscrowAction,
	EscrowExecutionAction,
	EscrowDispute,
	ACTION_TO_PATH,
	toSdkRefreshConfig,
} from "./types.js";
import { buildEscrowScriptConfig, getSignersForPath, createRefreshPath } from "./escrow-script.js";
import { ESCROW_STATE_MACHINE, canExecute, isFinalState } from "./escrow-state-machine.js";
import {
	RefreshConfig,
	DelegatedRefreshFlow,
} from "../../refresh/index.js";

/**
 * Escrow Contract
 *
 * Implements a 2-of-3 escrow with sender, receiver, and arbiter roles.
 * Provides 6 spending paths: 3 collaborative (with server) and 3 unilateral (timelocked).
 *
 * @example
 * ```typescript
 * const escrow = new EscrowContract({
 *   sender: { role: "sender", pubkey: senderKey },
 *   receiver: { role: "receiver", pubkey: receiverKey },
 *   serverPubkey: serverKey,
 *   unilateralDelay: { type: "blocks", value: 144 },
 *   amount: 100000,
 *   description: "Payment for goods",
 * });
 *
 * // Get funding address
 * const address = escrow.getAddress(protocol);
 *
 * // Check state
 * console.log(escrow.getState()); // "draft"
 *
 * // Counterparty accepts
 * await escrow.accept();
 * console.log(escrow.getState()); // "created"
 *
 * // Fund the escrow (detected externally)
 * await escrow.fund([{ txid: "...", vout: 0, value: 100000 }]);
 * console.log(escrow.getState()); // "funded"
 *
 * // Execute settlement
 * const execution = escrow.createExecution({
 *   action: "settle",
 *   destinationAddress: receiverAddress,
 * });
 * ```
 */
export class EscrowContract {
	readonly id: string;
	private readonly config: EscrowConfig;
	private readonly scriptBuilder: ScriptBuilder;
	private readonly stateMachine: ContractStateMachine<EscrowState, EscrowAction>;
	private data: EscrowData;
	private metadata: ContractMetadata;
	private storage?: StorageAdapter;
	private dispute?: EscrowDispute;
	private readonly refreshConfig: RefreshConfig | null;
	private refreshFlow: DelegatedRefreshFlow | null = null;

	constructor(config: EscrowConfig, options?: { storage?: StorageAdapter; id?: string }) {
		this.id = options?.id ?? nanoid(16);
		this.config = config;
		this.storage = options?.storage;

		// Build script configuration
		const scriptConfig = buildEscrowScriptConfig(config);
		this.scriptBuilder = new ScriptBuilder(scriptConfig);

		// Initialize state machine
		this.stateMachine = new ContractStateMachine(ESCROW_STATE_MACHINE);

		// Get or create arbiter
		const arbiter: Party = config.arbiter ?? {
			role: "arbiter",
			pubkey: config.serverPubkey,
		};

		// Initialize data
		this.data = {
			sender: config.sender,
			receiver: config.receiver,
			arbiter,
			amount: config.amount,
			description: config.description,
			fundedAmount: 0,
			vtxos: [],
			receiverAddress: config.receiverAddress,
			senderAddress: config.senderAddress,
			nonce: config.nonce,
		};

		// Initialize metadata
		this.metadata = {
			id: this.id,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			version: 1,
			contractType: "escrow",
		};

		// Initialize refresh config
		this.refreshConfig = toSdkRefreshConfig(config.refresh);
	}

	// ==================== State Management ====================

	/**
	 * Get the current contract state.
	 */
	getState(): EscrowState {
		return this.stateMachine.getState();
	}

	/**
	 * Get allowed actions from the current state.
	 */
	getAllowedActions(): EscrowAction[] {
		return this.stateMachine.getAllowedActions() as EscrowAction[];
	}

	/**
	 * Check if an action is allowed.
	 */
	canPerform(action: EscrowAction): boolean {
		return this.stateMachine.canPerform(action);
	}

	/**
	 * Check if contract is in a final state.
	 */
	isFinal(): boolean {
		return isFinalState(this.getState());
	}

	/**
	 * Check if contract can be executed (funded or pending).
	 */
	canExecute(): boolean {
		return canExecute(this.getState());
	}

	// ==================== State Transitions ====================

	/**
	 * Accept the contract (called by counterparty).
	 */
	async accept(): Promise<void> {
		await this.stateMachine.perform("accept");
		await this.save();
	}

	/**
	 * Reject the contract (called by counterparty).
	 */
	async reject(): Promise<void> {
		await this.stateMachine.perform("reject");
		await this.save();
	}

	/**
	 * Cancel the contract (called by creator).
	 */
	async cancel(): Promise<void> {
		await this.stateMachine.perform("cancel");
		await this.save();
	}

	/**
	 * Record funding of the contract.
	 *
	 * @param vtxos - The VTXOs that funded this contract
	 */
	async fund(vtxos: VtxoRef[]): Promise<void> {
		this.data.vtxos = vtxos;
		this.data.fundedAmount = vtxos.reduce((sum, v) => sum + v.value, 0);
		await this.stateMachine.perform("fund");
		await this.save();
	}

	/**
	 * Open a dispute.
	 *
	 * @param claimantRole - Who is opening the dispute
	 * @param reason - Reason for the dispute
	 */
	async openDispute(
		claimantRole: "sender" | "receiver",
		reason: string,
	): Promise<void> {
		this.dispute = {
			claimantRole,
			defendantRole: claimantRole === "sender" ? "receiver" : "sender",
			reason,
			openedAt: Date.now(),
		};
		await this.stateMachine.perform("dispute");
		await this.save();
	}

	/**
	 * Void the contract (arbiter only).
	 */
	async void(): Promise<void> {
		await this.stateMachine.perform("void");
		await this.save();
	}

	// ==================== Execution ====================

	/**
	 * Get the spending path name for an execution action.
	 */
	getSpendingPathForAction(action: EscrowExecutionAction): string {
		return ACTION_TO_PATH[action];
	}

	/**
	 * Get the signers required for an execution action.
	 */
	getSignersForAction(action: EscrowExecutionAction): string[] {
		const pathName = this.getSpendingPathForAction(action);
		return getSignersForPath(pathName);
	}

	/**
	 * Get the TapLeafScript for an execution action.
	 */
	getSpendingPath(action: EscrowExecutionAction) {
		const pathName = this.getSpendingPathForAction(action);
		return this.scriptBuilder.getSpendingPath(pathName);
	}

	/**
	 * Mark an execution as complete (called after successful transaction).
	 */
	async completeExecution(action: EscrowExecutionAction): Promise<void> {
		await this.stateMachine.perform(action);
		await this.save();
	}

	// ==================== Data Access ====================

	/**
	 * Get the escrow address.
	 *
	 * @param protocol - The protocol provider to use for address generation
	 */
	async getAddress(protocol: ProtocolProvider): Promise<string> {
		const info = await protocol.getInfo();
		const address = this.scriptBuilder.getAddress(
			info.addressPrefix,
			info.serverPubkey,
		);
		this.data.escrowAddress = address;
		return address;
	}

	/**
	 * Get the escrow address synchronously if server pubkey is known.
	 */
	getAddressSync(prefix: string, serverPubkey: XOnlyPubKey): string {
		const address = this.scriptBuilder.getAddress(prefix, serverPubkey);
		this.data.escrowAddress = address;
		return address;
	}

	/**
	 * Get the contract data.
	 */
	getData(): EscrowData {
		return { ...this.data };
	}

	/**
	 * Get the contract metadata.
	 */
	getMetadata(): ContractMetadata {
		return { ...this.metadata };
	}

	/**
	 * Get a party by role.
	 */
	getParty(role: string): Party | undefined {
		return this.scriptBuilder.getParty(role);
	}

	/**
	 * Get the sender party.
	 */
	getSender(): Party {
		return this.data.sender;
	}

	/**
	 * Get the receiver party.
	 */
	getReceiver(): Party {
		return this.data.receiver;
	}

	/**
	 * Get the arbiter party.
	 */
	getArbiter(): Party {
		return this.data.arbiter;
	}

	/**
	 * Get the escrowed amount.
	 */
	getAmount(): number {
		return this.data.amount;
	}

	/**
	 * Get the funded amount.
	 */
	getFundedAmount(): number {
		return this.data.fundedAmount;
	}

	/**
	 * Get the VTXOs funding this contract.
	 */
	getVtxos(): VtxoRef[] {
		return [...this.data.vtxos];
	}

	/**
	 * Get the dispute info (if any).
	 */
	getDispute(): EscrowDispute | undefined {
		return this.dispute;
	}

	/**
	 * Get the underlying script builder.
	 */
	getScriptBuilder(): ScriptBuilder {
		return this.scriptBuilder;
	}

	/**
	 * Get the tap tree for transaction building.
	 */
	getTapTree(): Uint8Array {
		return this.scriptBuilder.getTapTree();
	}

	// ==================== Refresh Support ====================

	/**
	 * Check if refresh is enabled for this contract.
	 */
	isRefreshEnabled(): boolean {
		return this.refreshConfig?.enabled ?? false;
	}

	/**
	 * Get the refresh configuration.
	 */
	getRefreshConfig(): RefreshConfig | null {
		return this.refreshConfig;
	}

	/**
	 * Get the refresh flow for this contract.
	 *
	 * Since escrow is multi-party, this returns a DelegatedRefreshFlow
	 * where one of the parties acts as delegate.
	 *
	 * @throws If refresh is not enabled
	 */
	getRefreshFlow(): DelegatedRefreshFlow {
		if (!this.isRefreshEnabled() || !this.refreshConfig) {
			throw new Error("Refresh is not enabled for this contract");
		}

		// Lazily create the refresh flow
		if (!this.refreshFlow) {
			const refreshPath = createRefreshPath(this.config.unilateralDelay);

			// Get the leaf script bytes (Uint8Array), not TapLeafScript object
			let refreshLeafScript: Uint8Array;
			try {
				refreshLeafScript = this.scriptBuilder.getLeafScript("refresh");
			} catch {
				throw new Error("Refresh spending path not found in script");
			}

			// Build parties map
			const parties = new Map<string, XOnlyPubKey>();
			parties.set("sender", this.data.sender.pubkey);
			parties.set("receiver", this.data.receiver.pubkey);
			parties.set("arbiter", this.data.arbiter.pubkey);
			parties.set("server", this.config.serverPubkey);

			this.refreshFlow = new DelegatedRefreshFlow(
				this.refreshConfig,
				{
					tapTree: this.getTapTree(),
					refreshPath,
					refreshLeafScript,
					destinationScript: this.data.escrowAddress ?? "",
				},
				parties,
			);
		}

		return this.refreshFlow;
	}

	/**
	 * Get the roles that can act as delegate for refresh.
	 */
	getDelegateRoles(): string[] {
		if (!this.isRefreshEnabled() || !this.refreshConfig) {
			return [];
		}

		const source = this.refreshConfig.delegateSource;
		if (source.type === "existing-party") {
			return [...source.roles];
		}

		return [];
	}

	/**
	 * Check if a role can act as delegate.
	 */
	canBeDelegate(role: string): boolean {
		return this.getDelegateRoles().includes(role);
	}

	// ==================== Persistence ====================

	/**
	 * Save the contract to storage.
	 */
	private async save(): Promise<void> {
		if (!this.storage) return;

		this.metadata.updatedAt = Date.now();
		this.metadata.version++;

		const stored: StoredContract<EscrowData> = {
			metadata: this.metadata,
			state: this.getState(),
			data: this.data,
			scriptConfig: this.scriptBuilder.getConfig(),
		};

		await this.storage.save(this.id, stored);
	}

	/**
	 * Serialize the contract for persistence or transmission.
	 */
	serialize(): string {
		return JSON.stringify({
			id: this.id,
			config: {
				sender: {
					...this.config.sender,
					pubkey: Array.from(this.config.sender.pubkey),
				},
				receiver: {
					...this.config.receiver,
					pubkey: Array.from(this.config.receiver.pubkey),
				},
				arbiter: this.config.arbiter
					? {
							...this.config.arbiter,
							pubkey: Array.from(this.config.arbiter.pubkey),
						}
					: undefined,
				serverPubkey: Array.from(this.config.serverPubkey),
				unilateralDelay: this.config.unilateralDelay,
				amount: this.config.amount,
				description: this.config.description,
				nonce: this.config.nonce,
				receiverAddress: this.config.receiverAddress,
				senderAddress: this.config.senderAddress,
			},
			state: this.getState(),
			data: {
				...this.data,
				sender: {
					...this.data.sender,
					pubkey: Array.from(this.data.sender.pubkey),
				},
				receiver: {
					...this.data.receiver,
					pubkey: Array.from(this.data.receiver.pubkey),
				},
				arbiter: {
					...this.data.arbiter,
					pubkey: Array.from(this.data.arbiter.pubkey),
				},
			},
			metadata: this.metadata,
			dispute: this.dispute,
		});
	}

	/**
	 * Deserialize a contract from persisted data.
	 */
	static deserialize(data: string, storage?: StorageAdapter): EscrowContract {
		const parsed = JSON.parse(data);

		const config: EscrowConfig = {
			sender: {
				...parsed.config.sender,
				pubkey: new Uint8Array(parsed.config.sender.pubkey),
			},
			receiver: {
				...parsed.config.receiver,
				pubkey: new Uint8Array(parsed.config.receiver.pubkey),
			},
			arbiter: parsed.config.arbiter
				? {
						...parsed.config.arbiter,
						pubkey: new Uint8Array(parsed.config.arbiter.pubkey),
					}
				: undefined,
			serverPubkey: new Uint8Array(parsed.config.serverPubkey),
			unilateralDelay: parsed.config.unilateralDelay,
			amount: parsed.config.amount,
			description: parsed.config.description,
			nonce: parsed.config.nonce,
			receiverAddress: parsed.config.receiverAddress,
			senderAddress: parsed.config.senderAddress,
		};

		const contract = new EscrowContract(config, { storage, id: parsed.id });

		// Restore state
		contract.stateMachine.setState(parsed.state);
		contract.data = {
			...parsed.data,
			sender: {
				...parsed.data.sender,
				pubkey: new Uint8Array(parsed.data.sender.pubkey),
			},
			receiver: {
				...parsed.data.receiver,
				pubkey: new Uint8Array(parsed.data.receiver.pubkey),
			},
			arbiter: {
				...parsed.data.arbiter,
				pubkey: new Uint8Array(parsed.data.arbiter.pubkey),
			},
		};
		contract.metadata = parsed.metadata;
		contract.dispute = parsed.dispute;

		return contract;
	}
}
