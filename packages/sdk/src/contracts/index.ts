/**
 * Contracts module - State machines and contract lifecycle management
 *
 * This module provides abstractions for building contracts with
 * customizable state machines and lifecycle management.
 */

// Types
export type {
	StateDefinition,
	StateTransition,
	StateMachineConfig,
	ContractMetadata,
	ContractContext,
	BaseContractConfig,
	ActionResult,
	FundingStatus,
	FundingInfo,
	ExecutionRequest,
	ExecutionStatus,
	Execution,
} from "./types.js";

export { ContractError } from "./types.js";

// State machine
export {
	ContractStateMachine,
	createState,
	createTransition,
} from "./state-machine.js";
