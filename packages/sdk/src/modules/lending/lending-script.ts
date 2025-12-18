/**
 * Lending Script Builder
 *
 * Builds the lending-specific script configuration.
 */

import {
	ScriptConfig,
	SpendingPath,
	Party,
	Timelock,
	createMultisigPath,
	createTimelockedPath,
} from "../../core/index.js";
import { LendingConfig, LendingRole } from "./types.js";
import { stringToBytes } from "../../utils/index.js";

/**
 * Create the lending contract spending paths.
 *
 * Lending has multiple spending paths:
 * - Collaborative paths (require server):
 *   - release-collateral: Return collateral to borrower (loan repaid)
 *   - liquidate: Transfer collateral to lender/liquidator (default)
 *   - disburse: Confirm loan disbursement
 * - Unilateral paths (timelocked):
 *   - unilateral-release: Borrower + Lender release after timelock
 *   - unilateral-liquidate: Lender + Liquidator claim after timelock
 */
export function createLendingSpendingPaths(
	unilateralDelay: Timelock,
): SpendingPath[] {
	return [
		// Collaborative paths
		createMultisigPath(
			"release-collateral",
			"Return collateral to borrower after successful repayment",
			["borrower", "lender", "server"],
		),
		createMultisigPath(
			"liquidate",
			"Transfer collateral to liquidator on default",
			["lender", "liquidator", "server"],
		),
		createMultisigPath(
			"emergency-release",
			"Emergency release requiring all parties",
			["borrower", "lender", "liquidator", "server"],
		),

		// Unilateral paths (timelocked)
		createTimelockedPath(
			"unilateral-release",
			"Borrower and lender release collateral after timelock",
			["borrower", "lender"],
			unilateralDelay,
		),
		createTimelockedPath(
			"unilateral-liquidate",
			"Lender and liquidator claim collateral after timelock",
			["lender", "liquidator"],
			unilateralDelay,
		),
	];
}

/**
 * Create the parties list for a lending contract.
 */
export function createLendingParties(config: LendingConfig): Party[] {
	// If no liquidator specified, use lender
	const liquidator: Party = config.liquidator ?? {
		...config.lender,
		role: "liquidator",
	};

	return [
		{ ...config.borrower, role: "borrower" },
		{ ...config.lender, role: "lender" },
		{ ...liquidator, role: "liquidator" },
		{
			role: "server",
			pubkey: config.serverPubkey,
			displayName: "Server",
		},
	];
}

/**
 * Build the complete script configuration for a lending contract.
 */
export function buildLendingScriptConfig(config: LendingConfig): ScriptConfig {
	const parties = createLendingParties(config);
	const spendingPaths = createLendingSpendingPaths(config.unilateralDelay);

	const nonce = config.nonce ? stringToBytes(config.nonce) : undefined;

	return {
		parties,
		spendingPaths,
		nonce,
		protocolServerKey: config.serverPubkey,
	};
}

/**
 * Get the signers required for a spending path.
 */
export function getSignersForPath(pathName: string): LendingRole[] {
	const signers: Record<string, LendingRole[]> = {
		"release-collateral": ["borrower", "lender", "server"],
		liquidate: ["lender", "liquidator", "server"],
		"emergency-release": ["borrower", "lender", "liquidator", "server"],
		"unilateral-release": ["borrower", "lender"],
		"unilateral-liquidate": ["lender", "liquidator"],
	};

	return signers[pathName] ?? [];
}

/**
 * Calculate repayment amount from principal and interest.
 */
export function calculateRepaymentAmount(
	principal: number,
	interestRateBps: number,
): number {
	return principal + Math.floor((principal * interestRateBps) / 10000);
}

/**
 * Calculate required collateral from loan amount and ratio.
 */
export function calculateRequiredCollateral(
	loanAmount: number,
	collateralizationRatio: number,
): number {
	return Math.floor((loanAmount * collateralizationRatio) / 100);
}

/**
 * Check if collateral is sufficient.
 */
export function isCollateralSufficient(
	depositedCollateral: number,
	requiredCollateral: number,
): boolean {
	return depositedCollateral >= requiredCollateral;
}
