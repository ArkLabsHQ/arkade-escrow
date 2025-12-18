/**
 * Lending Contract
 *
 * High-level collateralized lending contract implementation.
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
	LendingConfig,
	LendingData,
	LendingState,
	LendingAction,
	Repayment,
} from "./types.js";
import {
	buildLendingScriptConfig,
	isCollateralSufficient,
} from "./lending-script.js";
import { LENDING_STATE_MACHINE, isFinalState } from "./lending-state-machine.js";

/**
 * Lending Contract
 *
 * Implements a collateralized lending contract with:
 * - Borrower deposits collateral
 * - Lender disburses loan
 * - Borrower repays to reclaim collateral
 * - Liquidation on default
 *
 * @example
 * ```typescript
 * const loan = new LendingContract({
 *   borrower: { role: "borrower", pubkey: borrowerKey },
 *   lender: { role: "lender", pubkey: lenderKey },
 *   serverPubkey: serverKey,
 *   collateralAmount: 1000000,
 *   loanAmount: 500000,
 *   interestRateBps: 500, // 5%
 *   repaymentAmount: 525000,
 *   loanDuration: { type: "blocks", value: 4320 },
 *   gracePeriod: { type: "blocks", value: 144 },
 *   unilateralDelay: { type: "blocks", value: 144 },
 *   collateralizationRatio: 200,
 * });
 *
 * // Get collateral address
 * const address = await loan.getAddress(protocol);
 *
 * // Deposit collateral
 * await loan.depositCollateral([{ txid: "...", vout: 0, value: 1000000 }]);
 *
 * // Disburse loan
 * await loan.disburse();
 *
 * // Repay
 * await loan.repay(525000);
 *
 * // Release collateral
 * await loan.releaseCollateral(borrowerAddress);
 * ```
 */
export class LendingContract {
	readonly id: string;
	readonly config: LendingConfig;
	private readonly scriptBuilder: ScriptBuilder;
	private readonly stateMachine: ContractStateMachine<LendingState, LendingAction>;
	private data: LendingData;
	private metadata: ContractMetadata;
	private storage?: StorageAdapter;
	private repayments: Repayment[] = [];

	constructor(config: LendingConfig, options?: { storage?: StorageAdapter; id?: string }) {
		this.id = options?.id ?? nanoid(16);
		this.config = config;
		this.storage = options?.storage;

		// Build script configuration
		const scriptConfig = buildLendingScriptConfig(config);
		this.scriptBuilder = new ScriptBuilder(scriptConfig);

		// Initialize state machine
		this.stateMachine = new ContractStateMachine(LENDING_STATE_MACHINE);

		// Get or create liquidator
		const liquidator: Party = config.liquidator ?? {
			...config.lender,
			role: "liquidator",
		};

		// Initialize data
		this.data = {
			borrower: config.borrower,
			lender: config.lender,
			liquidator,
			collateralAmount: config.collateralAmount,
			loanAmount: config.loanAmount,
			interestRateBps: config.interestRateBps,
			repaymentAmount: config.repaymentAmount,
			amountRepaid: 0,
			collateralDeposited: 0,
			collateralVtxos: [],
			loanDuration: config.loanDuration,
			description: config.description,
			nonce: config.nonce,
		};

		// Initialize metadata
		this.metadata = {
			id: this.id,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			version: 1,
			contractType: "lending",
		};
	}

	// ==================== State Management ====================

	getState(): LendingState {
		return this.stateMachine.getState();
	}

	getAllowedActions(): LendingAction[] {
		return this.stateMachine.getAllowedActions() as LendingAction[];
	}

	canPerform(action: LendingAction): boolean {
		return this.stateMachine.canPerform(action);
	}

	isFinal(): boolean {
		return isFinalState(this.getState());
	}

	// ==================== State Transitions ====================

	async accept(): Promise<void> {
		await this.stateMachine.perform("accept");
		await this.save();
	}

	async reject(): Promise<void> {
		await this.stateMachine.perform("reject");
		await this.save();
	}

	async cancel(): Promise<void> {
		await this.stateMachine.perform("cancel");
		await this.save();
	}

	/**
	 * Record collateral deposit.
	 */
	async depositCollateral(vtxos: VtxoRef[]): Promise<void> {
		this.data.collateralVtxos = vtxos;
		this.data.collateralDeposited = vtxos.reduce((sum, v) => sum + v.value, 0);

		if (!isCollateralSufficient(this.data.collateralDeposited, this.data.collateralAmount)) {
			throw new Error(
				`Insufficient collateral: ${this.data.collateralDeposited} < ${this.data.collateralAmount}`,
			);
		}

		await this.stateMachine.perform("deposit-collateral");
		await this.save();
	}

	/**
	 * Record loan disbursement.
	 */
	async disburse(): Promise<void> {
		this.data.activatedAt = Date.now();

		// Calculate due date based on loan duration
		if (this.data.loanDuration.type === "seconds") {
			this.data.dueAt = this.data.activatedAt + this.data.loanDuration.value * 1000;
		} else {
			// For blocks, we approximate (10 min per block)
			this.data.dueAt = this.data.activatedAt + this.data.loanDuration.value * 10 * 60 * 1000;
		}

		await this.stateMachine.perform("disburse");
		await this.save();
	}

	/**
	 * Record a repayment.
	 */
	async repay(amount: number, txid?: string): Promise<void> {
		this.data.amountRepaid += amount;
		this.repayments.push({
			amount,
			txid: txid ?? "",
			timestamp: Date.now(),
		});

		await this.stateMachine.perform("repay");
		await this.save();
	}

	/**
	 * Check if loan is fully repaid.
	 */
	isFullyRepaid(): boolean {
		return this.data.amountRepaid >= this.data.repaymentAmount;
	}

	/**
	 * Get remaining repayment amount.
	 */
	getRemainingRepayment(): number {
		return Math.max(0, this.data.repaymentAmount - this.data.amountRepaid);
	}

	/**
	 * Mark loan as defaulted.
	 */
	async markDefaulted(): Promise<void> {
		await this.stateMachine.perform("default");
		await this.save();
	}

	/**
	 * Complete collateral release (after full repayment).
	 */
	async releaseCollateral(): Promise<void> {
		if (!this.isFullyRepaid()) {
			throw new Error("Loan not fully repaid");
		}
		await this.stateMachine.perform("release-collateral");
		await this.save();
	}

	/**
	 * Complete liquidation (after default).
	 */
	async liquidate(): Promise<void> {
		await this.stateMachine.perform("liquidate");
		await this.save();
	}

	// ==================== Data Access ====================

	async getAddress(protocol: ProtocolProvider): Promise<string> {
		const info = await protocol.getInfo();
		const address = this.scriptBuilder.getAddress(info.addressPrefix, info.serverPubkey);
		this.data.collateralAddress = address;
		return address;
	}

	getAddressSync(prefix: string, serverPubkey: XOnlyPubKey): string {
		const address = this.scriptBuilder.getAddress(prefix, serverPubkey);
		this.data.collateralAddress = address;
		return address;
	}

	getData(): LendingData {
		return { ...this.data };
	}

	getMetadata(): ContractMetadata {
		return { ...this.metadata };
	}

	getBorrower(): Party {
		return this.data.borrower;
	}

	getLender(): Party {
		return this.data.lender;
	}

	getLiquidator(): Party {
		return this.data.liquidator;
	}

	getCollateralAmount(): number {
		return this.data.collateralAmount;
	}

	getLoanAmount(): number {
		return this.data.loanAmount;
	}

	getRepaymentAmount(): number {
		return this.data.repaymentAmount;
	}

	getRepayments(): Repayment[] {
		return [...this.repayments];
	}

	getScriptBuilder(): ScriptBuilder {
		return this.scriptBuilder;
	}

	// ==================== Persistence ====================

	private async save(): Promise<void> {
		if (!this.storage) return;

		this.metadata.updatedAt = Date.now();
		this.metadata.version++;

		const stored: StoredContract<LendingData> = {
			metadata: this.metadata,
			state: this.getState(),
			data: this.data,
			scriptConfig: this.scriptBuilder.getConfig(),
		};

		await this.storage.save(this.id, stored);
	}
}
