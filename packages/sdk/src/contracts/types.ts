/**
 * Contract layer types
 *
 * Types for defining contract state machines and lifecycle management.
 */

import { Party, ScriptConfig, SpendingPath } from "../core/types.js";
import { VtxoRef } from "../transactions/types.js";

/**
 * Generic state definition for a contract state machine.
 */
export interface StateDefinition<TState extends string> {
	/** The state name */
	name: TState;
	/** Actions allowed from this state */
	allowedActions: string[];
	/** Is this a terminal state (no further transitions)? */
	isFinal: boolean;
	/** Human-readable description of this state */
	description?: string;
}

/**
 * State transition definition.
 */
export interface StateTransition<
	TState extends string,
	TAction extends string,
> {
	/** Source state(s) for this transition */
	from: TState | TState[];
	/** Action that triggers this transition */
	action: TAction;
	/** Target state after transition */
	to: TState;
	/** Optional guard condition that must be true for transition to occur */
	guard?: (context: unknown) => boolean;
	/** Optional async guard condition */
	guardAsync?: (context: unknown) => Promise<boolean>;
	/** Side effects to execute on transition */
	onTransition?: (context: unknown) => void | Promise<void>;
}

/**
 * State machine configuration.
 */
export interface StateMachineConfig<
	TState extends string,
	TAction extends string,
> {
	/** Initial state when contract is created */
	initialState: TState;
	/** All possible states */
	states: StateDefinition<TState>[];
	/** All possible transitions */
	transitions: StateTransition<TState, TAction>[];
}

/**
 * Contract metadata stored alongside contract data.
 */
export interface ContractMetadata {
	/** Unique contract identifier */
	id: string;
	/** When the contract was created (Unix timestamp ms) */
	createdAt: number;
	/** When the contract was last updated (Unix timestamp ms) */
	updatedAt: number;
	/** Version number (incremented on each update) */
	version: number;
	/** Contract type identifier (e.g., "escrow", "lending") */
	contractType: string;
}

/**
 * Base contract context passed to state machine guards and transitions.
 */
export interface ContractContext<TData = unknown> {
	/** Contract metadata */
	metadata: ContractMetadata;
	/** Contract-specific data */
	data: TData;
	/** The parties involved */
	parties: Party[];
	/** Current funding state */
	funding?: {
		vtxos: VtxoRef[];
		totalValue: number;
	};
}

/**
 * Base configuration for any contract type.
 */
export interface BaseContractConfig<
	TState extends string,
	TAction extends string,
> {
	/** Unique contract identifier */
	id: string;
	/** Contract type identifier */
	contractType: string;
	/** State machine configuration */
	stateMachine: StateMachineConfig<TState, TAction>;
	/** Script configuration for this contract */
	scriptConfig: ScriptConfig;
}

/**
 * Contract action result.
 */
export interface ActionResult<TState extends string> {
	/** Previous state */
	previousState: TState;
	/** New state after action */
	newState: TState;
	/** The action that was performed */
	action: string;
	/** Whether a state transition occurred */
	transitioned: boolean;
	/** Additional result data */
	data?: unknown;
}

/**
 * Error thrown during contract operations.
 */
export class ContractError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "ContractError";
	}
}

/**
 * Funding status for a contract.
 */
export type FundingStatus =
	| "unfunded"
	| "partially-funded"
	| "funded"
	| "overfunded";

/**
 * Funding information for a contract.
 */
export interface FundingInfo {
	/** Current funding status */
	status: FundingStatus;
	/** Required amount in satoshis */
	requiredAmount: number;
	/** Current amount funded in satoshis */
	currentAmount: number;
	/** VTXOs that have funded this contract */
	vtxos: VtxoRef[];
	/** The address to fund */
	fundingAddress: string;
}

/**
 * Execution request for performing an action on a contract.
 */
export interface ExecutionRequest {
	/** The action to perform */
	action: string;
	/** The spending path to use (if applicable) */
	spendingPath?: string;
	/** Destination address for funds (if applicable) */
	destinationAddress?: string;
	/** Custom amount (if not using full balance) */
	amount?: number;
	/** Additional parameters */
	params?: Record<string, unknown>;
}

/**
 * Execution status for tracking pending executions.
 */
export type ExecutionStatus =
	| "pending-signatures"
	| "ready-to-submit"
	| "submitted"
	| "confirmed"
	| "failed"
	| "rejected"
	| "expired";

/**
 * Execution tracking for a contract action.
 */
export interface Execution {
	/** Unique execution identifier */
	id: string;
	/** Contract ID this execution belongs to */
	contractId: string;
	/** The action being executed */
	action: string;
	/** Current execution status */
	status: ExecutionStatus;
	/** The spending path being used */
	spendingPath: SpendingPath;
	/** Roles that need to sign */
	requiredSigners: string[];
	/** Roles that have signed */
	completedSigners: string[];
	/** When the execution was created */
	createdAt: number;
	/** When the execution was last updated */
	updatedAt: number;
	/** Transaction ID if submitted */
	txid?: string;
	/** Error message if failed */
	error?: string;
}
