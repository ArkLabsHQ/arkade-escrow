/**
 * Lending State Machine Configuration
 *
 * Defines the state machine for lending contract lifecycle.
 */

import {
	StateMachineConfig,
	createState,
	createTransition,
} from "../../contracts/index.js";
import { LendingState, LendingAction } from "./types.js";

/**
 * Lending state machine configuration.
 */
export const LENDING_STATE_MACHINE: StateMachineConfig<
	LendingState,
	LendingAction
> = {
	initialState: "proposed",
	states: [
		createState("proposed", ["accept", "reject", "cancel"], {
			description: "Loan terms proposed, waiting for acceptance",
		}),
		createState("accepted", ["deposit-collateral", "cancel"], {
			description: "Terms accepted, waiting for collateral",
		}),
		createState("collateralized", ["disburse", "cancel"], {
			description: "Collateral deposited, waiting for disbursement",
		}),
		createState("active", ["repay", "default"], {
			description: "Loan active, repayment period ongoing",
		}),
		createState("repaying", ["repay", "release-collateral", "default"], {
			description: "Partial repayments received",
		}),
		createState(
			"defaulted",
			["liquidate", "repay", "unilateral-liquidate"],
			{
				description: "Borrower defaulted, grace period active",
			},
		),
		createState("liquidated", [], {
			isFinal: true,
			description: "Collateral claimed by liquidator",
		}),
		createState("completed", [], {
			isFinal: true,
			description: "Loan fully repaid, collateral returned",
		}),
		createState("canceled", [], {
			isFinal: true,
			description: "Loan canceled before activation",
		}),
	],
	transitions: [
		// From proposed
		createTransition("proposed", "accept", "accepted"),
		createTransition("proposed", "reject", "canceled"),
		createTransition("proposed", "cancel", "canceled"),

		// From accepted
		createTransition("accepted", "deposit-collateral", "collateralized"),
		createTransition("accepted", "cancel", "canceled"),

		// From collateralized
		createTransition("collateralized", "disburse", "active"),
		createTransition("collateralized", "cancel", "canceled"),

		// From active
		createTransition("active", "repay", "repaying"),
		createTransition("active", "default", "defaulted"),

		// From repaying
		createTransition("repaying", "repay", "repaying"), // Partial repayment
		createTransition("repaying", "release-collateral", "completed"), // Full repayment
		createTransition("repaying", "default", "defaulted"),

		// From defaulted
		createTransition("defaulted", "liquidate", "liquidated"),
		createTransition("defaulted", "unilateral-liquidate", "liquidated"),
		createTransition("defaulted", "repay", "repaying"), // Late repayment allowed
	],
};

/**
 * Check if a state allows collateral operations.
 */
export function canOperateOnCollateral(state: LendingState): boolean {
	return ["collateralized", "active", "repaying", "defaulted"].includes(state);
}

/**
 * Check if loan is in repayment phase.
 */
export function isRepaymentPhase(state: LendingState): boolean {
	return state === "active" || state === "repaying";
}

/**
 * Check if loan can be liquidated.
 */
export function canLiquidate(state: LendingState): boolean {
	return state === "defaulted";
}

/**
 * Check if state is terminal.
 */
export function isFinalState(state: LendingState): boolean {
	return ["liquidated", "completed", "canceled"].includes(state);
}
