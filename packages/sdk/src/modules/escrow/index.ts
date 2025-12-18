/**
 * Escrow Module
 *
 * Complete escrow contract implementation using SDK primitives.
 * Provides a 2-of-3 escrow with sender, receiver, and arbiter roles.
 */

// Types
export type {
	EscrowRole,
	EscrowState,
	EscrowAction,
	EscrowExecutionAction,
	EscrowConfig,
	EscrowData,
	EscrowExecutionRequest,
	EscrowDispute,
} from "./types.js";

export { ACTION_TO_PATH, PATH_TO_SIGNERS } from "./types.js";

// Script utilities
export {
	createEscrowSpendingPaths,
	createEscrowParties,
	buildEscrowScriptConfig,
	getSignersForPath,
	isCollaborativePath,
	isTimelockedPath,
	getDestinationRole,
} from "./escrow-script.js";

// State machine
export {
	ESCROW_STATE_MACHINE,
	canExecute,
	isFinalState,
	isActiveState,
	getAllowedActions,
} from "./escrow-state-machine.js";

// Main contract class
export { EscrowContract } from "./escrow-contract.js";
