/**
 * Escrow State Machine Configuration
 *
 * Defines the state machine for escrow contract lifecycle.
 */

import {
	StateMachineConfig,
	createState,
	createTransition,
} from "../../contracts/index.js";
import { EscrowState, EscrowAction } from "./types.js";

/**
 * Default escrow state machine configuration.
 *
 * States:
 * - draft: Initial state, waiting for counterparty to accept
 * - created: Accepted, waiting for funding
 * - funded: Funded, ready for execution
 * - pending-execution: Execution in progress
 * - completed: Successfully completed (terminal)
 * - disputed: Under arbitration
 * - canceled: Canceled before funding (terminal)
 * - voided: Voided by arbiter (terminal)
 */
export const ESCROW_STATE_MACHINE: StateMachineConfig<
	EscrowState,
	EscrowAction
> = {
	initialState: "draft",
	states: [
		createState("draft", ["accept", "reject", "cancel"], {
			description: "Contract created, waiting for counterparty acceptance",
		}),
		createState("created", ["fund", "cancel"], {
			description: "Contract accepted, waiting for funding",
		}),
		createState("funded", ["release", "refund", "settle", "dispute"], {
			description: "Contract funded, ready for execution",
		}),
		createState(
			"pending-execution",
			[
				"release",
				"refund",
				"settle",
				"dispute",
				"unilateral-release",
				"unilateral-refund",
				"unilateral-settle",
			],
			{
				description: "Execution in progress, collecting signatures",
			},
		),
		createState("disputed", ["release", "refund", "void"], {
			description: "Under arbitration",
		}),
		createState("completed", [], {
			isFinal: true,
			description: "Contract successfully completed",
		}),
		createState("canceled", [], {
			isFinal: true,
			description: "Contract canceled before funding",
		}),
		createState("voided", [], {
			isFinal: true,
			description: "Contract voided by arbiter",
		}),
	],
	transitions: [
		// From draft
		createTransition("draft", "accept", "created"),
		createTransition("draft", "reject", "canceled"),
		createTransition("draft", "cancel", "canceled"),

		// From created
		createTransition("created", "fund", "funded"),
		createTransition("created", "cancel", "canceled"),

		// From funded - start execution
		createTransition("funded", "release", "pending-execution"),
		createTransition("funded", "refund", "pending-execution"),
		createTransition("funded", "settle", "pending-execution"),
		createTransition("funded", "dispute", "disputed"),

		// From pending-execution - execution completes or dispute
		createTransition(
			"pending-execution",
			"release",
			"completed",
		),
		createTransition(
			"pending-execution",
			"refund",
			"completed",
		),
		createTransition(
			"pending-execution",
			"settle",
			"completed",
		),
		createTransition(
			"pending-execution",
			"unilateral-release",
			"completed",
		),
		createTransition(
			"pending-execution",
			"unilateral-refund",
			"completed",
		),
		createTransition(
			"pending-execution",
			"unilateral-settle",
			"completed",
		),
		createTransition("pending-execution", "dispute", "disputed"),

		// From disputed - arbiter resolves
		createTransition("disputed", "release", "completed"),
		createTransition("disputed", "refund", "completed"),
		createTransition("disputed", "void", "voided"),
	],
};

/**
 * Check if a state allows execution actions.
 */
export function canExecute(state: EscrowState): boolean {
	return state === "funded" || state === "pending-execution";
}

/**
 * Check if a state is a terminal state.
 */
export function isFinalState(state: EscrowState): boolean {
	return state === "completed" || state === "canceled" || state === "voided";
}

/**
 * Check if a state means the contract is active (not canceled/completed).
 */
export function isActiveState(state: EscrowState): boolean {
	return !isFinalState(state);
}

/**
 * Get the allowed actions for a state.
 */
export function getAllowedActions(state: EscrowState): EscrowAction[] {
	const stateConfig = ESCROW_STATE_MACHINE.states.find((s) => s.name === state);
	return (stateConfig?.allowedActions ?? []) as EscrowAction[];
}
