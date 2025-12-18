/**
 * Lending Module
 *
 * Collateralized lending contract implementation using SDK primitives.
 */

// Types
export type {
	LendingRole,
	LendingState,
	LendingAction,
	LendingConfig,
	LendingData,
	Repayment,
} from "./types.js";

// Script utilities
export {
	createLendingSpendingPaths,
	createLendingParties,
	buildLendingScriptConfig,
	getSignersForPath,
	calculateRepaymentAmount,
	calculateRequiredCollateral,
	isCollateralSufficient,
} from "./lending-script.js";

// State machine
export {
	LENDING_STATE_MACHINE,
	canOperateOnCollateral,
	isRepaymentPhase,
	canLiquidate,
	isFinalState,
} from "./lending-state-machine.js";

// Main contract class
export { LendingContract } from "./lending-contract.js";
