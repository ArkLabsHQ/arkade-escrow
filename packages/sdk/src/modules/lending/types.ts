/**
 * Lending Module Types
 *
 * Types for a collateralized lending contract.
 *
 * In a lending contract:
 * - Borrower deposits collateral
 * - Lender disburses loan
 * - Borrower repays loan to receive collateral back
 * - If borrower defaults, lender (or liquidator) can claim collateral
 */

import { Party, Timelock, XOnlyPubKey } from "../../core/types.js";
import { VtxoRef } from "../../transactions/types.js";

/**
 * Lending-specific roles.
 */
export type LendingRole = "borrower" | "lender" | "liquidator" | "server";

/**
 * Lending contract states.
 *
 * Lifecycle:
 * - proposed: Loan terms proposed, waiting for counterparty
 * - accepted: Terms accepted, waiting for collateral
 * - collateralized: Collateral deposited, waiting for loan disbursement
 * - active: Loan disbursed, repayment period active
 * - repaying: Partial repayments received
 * - defaulted: Borrower missed payment deadline
 * - liquidated: Collateral claimed by lender/liquidator
 * - completed: Loan fully repaid, collateral returned
 * - canceled: Canceled before activation
 */
export type LendingState =
	| "proposed"
	| "accepted"
	| "collateralized"
	| "active"
	| "repaying"
	| "defaulted"
	| "liquidated"
	| "completed"
	| "canceled";

/**
 * Lending contract actions.
 */
export type LendingAction =
	| "accept" // Counterparty accepts terms
	| "reject" // Counterparty rejects terms
	| "cancel" // Cancel before activation
	| "deposit-collateral" // Borrower deposits collateral
	| "disburse" // Lender disburses loan
	| "repay" // Borrower makes repayment
	| "default" // Mark as defaulted (missed deadline)
	| "liquidate" // Liquidator claims collateral
	| "release-collateral" // Return collateral to borrower
	| "unilateral-release" // Timelocked collateral release
	| "unilateral-liquidate"; // Timelocked liquidation

/**
 * Configuration for creating a lending contract.
 */
export interface LendingConfig {
	/** Borrower party */
	borrower: Party;
	/** Lender party */
	lender: Party;
	/** Liquidator party (optional - defaults to lender) */
	liquidator?: Party;
	/** Protocol server public key */
	serverPubkey: XOnlyPubKey;
	/** Collateral amount in satoshis */
	collateralAmount: number;
	/** Loan principal amount in satoshis */
	loanAmount: number;
	/** Interest rate in basis points (e.g., 500 = 5%) */
	interestRateBps: number;
	/** Total repayment amount (principal + interest) */
	repaymentAmount: number;
	/** Loan duration */
	loanDuration: Timelock;
	/** Grace period after default before liquidation */
	gracePeriod: Timelock;
	/** Timelock for unilateral paths */
	unilateralDelay: Timelock;
	/** Collateralization ratio (percentage, e.g., 150 = 150%) */
	collateralizationRatio: number;
	/** Unique nonce for address generation */
	nonce?: string;
	/** Description of the loan */
	description?: string;
}

/**
 * Lending contract data.
 */
export interface LendingData {
	/** Borrower party */
	borrower: Party;
	/** Lender party */
	lender: Party;
	/** Liquidator party */
	liquidator: Party;
	/** Collateral amount */
	collateralAmount: number;
	/** Loan principal */
	loanAmount: number;
	/** Interest rate (bps) */
	interestRateBps: number;
	/** Total repayment amount */
	repaymentAmount: number;
	/** Amount repaid so far */
	amountRepaid: number;
	/** Collateral deposited */
	collateralDeposited: number;
	/** VTXOs holding collateral */
	collateralVtxos: VtxoRef[];
	/** Loan duration */
	loanDuration: Timelock;
	/** When the loan was activated */
	activatedAt?: number;
	/** When the loan is due */
	dueAt?: number;
	/** The collateral address */
	collateralAddress?: string;
	/** Description */
	description?: string;
	/** Nonce */
	nonce?: string;
}

/**
 * Repayment info.
 */
export interface Repayment {
	/** Amount repaid */
	amount: number;
	/** Transaction ID */
	txid: string;
	/** When the repayment was made */
	timestamp: number;
}
