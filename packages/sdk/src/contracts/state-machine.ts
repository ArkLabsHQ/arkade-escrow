/**
 * Contract State Machine
 *
 * A generic state machine for managing contract lifecycle states and transitions.
 * Supports guards, async operations, and side effects.
 */

import {
	StateMachineConfig,
	StateDefinition,
	StateTransition,
	ContractError,
} from "./types.js";

/**
 * Generic state machine for contract lifecycle management.
 *
 * This state machine supports:
 * - Typed states and actions
 * - Guard conditions (sync and async)
 * - Side effects on transitions
 * - State introspection
 *
 * @example
 * ```typescript
 * type EscrowState = "draft" | "created" | "funded" | "completed";
 * type EscrowAction = "accept" | "fund" | "release";
 *
 * const config: StateMachineConfig<EscrowState, EscrowAction> = {
 *   initialState: "draft",
 *   states: [
 *     { name: "draft", allowedActions: ["accept"], isFinal: false },
 *     { name: "created", allowedActions: ["fund"], isFinal: false },
 *     { name: "funded", allowedActions: ["release"], isFinal: false },
 *     { name: "completed", allowedActions: [], isFinal: true },
 *   ],
 *   transitions: [
 *     { from: "draft", action: "accept", to: "created" },
 *     { from: "created", action: "fund", to: "funded" },
 *     { from: "funded", action: "release", to: "completed" },
 *   ],
 * };
 *
 * const machine = new ContractStateMachine(config);
 * await machine.perform("accept", context);
 * console.log(machine.getState()); // "created"
 * ```
 */
export class ContractStateMachine<
	TState extends string,
	TAction extends string,
> {
	private currentState: TState;
	private readonly config: StateMachineConfig<TState, TAction>;
	private readonly stateMap: Map<TState, StateDefinition<TState>>;
	private readonly transitionMap: Map<string, StateTransition<TState, TAction>>;

	constructor(
		config: StateMachineConfig<TState, TAction>,
		initialState?: TState,
	) {
		this.config = config;
		this.currentState = initialState ?? config.initialState;

		// Build lookup maps for performance
		this.stateMap = new Map();
		for (const state of config.states) {
			this.stateMap.set(state.name, state);
		}

		this.transitionMap = new Map();
		for (const transition of config.transitions) {
			const froms = Array.isArray(transition.from)
				? transition.from
				: [transition.from];
			for (const from of froms) {
				const key = `${from}:${transition.action}`;
				this.transitionMap.set(key, transition);
			}
		}
	}

	/**
	 * Get the current state.
	 */
	getState(): TState {
		return this.currentState;
	}

	/**
	 * Get the state definition for the current state.
	 */
	getStateDefinition(): StateDefinition<TState> {
		const state = this.stateMap.get(this.currentState);
		if (!state) {
			throw new ContractError(
				`Unknown state: ${this.currentState}`,
				"UNKNOWN_STATE",
			);
		}
		return state;
	}

	/**
	 * Check if an action is allowed from the current state.
	 */
	canPerform(action: TAction): boolean {
		const state = this.stateMap.get(this.currentState);
		return state?.allowedActions.includes(action) ?? false;
	}

	/**
	 * Get the list of allowed actions from the current state.
	 */
	getAllowedActions(): string[] {
		const state = this.stateMap.get(this.currentState);
		return state?.allowedActions ?? [];
	}

	/**
	 * Get the transition for an action from the current state.
	 */
	getTransition(action: TAction): StateTransition<TState, TAction> | undefined {
		const key = `${this.currentState}:${action}`;
		return this.transitionMap.get(key);
	}

	/**
	 * Preview what state would result from an action without actually performing it.
	 */
	previewTransition(action: TAction): TState | undefined {
		const transition = this.getTransition(action);
		return transition?.to;
	}

	/**
	 * Perform an action, transitioning state if valid.
	 *
	 * @param action - The action to perform
	 * @param context - Context passed to guards and side effects
	 * @returns The new state after transition
	 * @throws ContractError if action is not allowed or guard fails
	 */
	async perform(action: TAction, context?: unknown): Promise<TState> {
		// Check if action is allowed
		if (!this.canPerform(action)) {
			throw new ContractError(
				`Action "${action}" is not allowed from state "${this.currentState}"`,
				"ACTION_NOT_ALLOWED",
				{
					action,
					currentState: this.currentState,
					allowedActions: this.getAllowedActions(),
				},
			);
		}

		// Get the transition
		const transition = this.getTransition(action);
		if (!transition) {
			throw new ContractError(
				`No transition found for action "${action}" from state "${this.currentState}"`,
				"TRANSITION_NOT_FOUND",
				{ action, currentState: this.currentState },
			);
		}

		// Check guard condition
		if (transition.guard && !transition.guard(context)) {
			throw new ContractError(
				`Guard condition failed for action "${action}"`,
				"GUARD_FAILED",
				{ action, currentState: this.currentState },
			);
		}

		// Check async guard condition
		if (transition.guardAsync && !(await transition.guardAsync(context))) {
			throw new ContractError(
				`Async guard condition failed for action "${action}"`,
				"GUARD_FAILED",
				{ action, currentState: this.currentState },
			);
		}

		// Execute side effects
		if (transition.onTransition) {
			await transition.onTransition(context);
		}

		// Perform the transition
		this.currentState = transition.to;

		return this.currentState;
	}

	/**
	 * Force the state to a specific value.
	 *
	 * Use this for initialization or recovery scenarios.
	 * Bypasses guards and side effects.
	 */
	setState(state: TState): void {
		if (!this.stateMap.has(state)) {
			throw new ContractError(
				`Unknown state: ${state}`,
				"UNKNOWN_STATE",
				{ state, validStates: Array.from(this.stateMap.keys()) },
			);
		}
		this.currentState = state;
	}

	/**
	 * Check if the current state is a final (terminal) state.
	 */
	isFinal(): boolean {
		const state = this.stateMap.get(this.currentState);
		return state?.isFinal ?? false;
	}

	/**
	 * Get all possible states.
	 */
	getAllStates(): TState[] {
		return Array.from(this.stateMap.keys());
	}

	/**
	 * Get all final (terminal) states.
	 */
	getFinalStates(): TState[] {
		return Array.from(this.stateMap.values())
			.filter((s) => s.isFinal)
			.map((s) => s.name);
	}

	/**
	 * Get all non-final states.
	 */
	getNonFinalStates(): TState[] {
		return Array.from(this.stateMap.values())
			.filter((s) => !s.isFinal)
			.map((s) => s.name);
	}

	/**
	 * Get the state machine configuration.
	 */
	getConfig(): StateMachineConfig<TState, TAction> {
		return this.config;
	}

	/**
	 * Create a copy of this state machine with the same configuration
	 * but potentially a different state.
	 */
	clone(initialState?: TState): ContractStateMachine<TState, TAction> {
		return new ContractStateMachine(
			this.config,
			initialState ?? this.currentState,
		);
	}

	/**
	 * Serialize the current state for persistence.
	 */
	serialize(): { state: TState; config: StateMachineConfig<TState, TAction> } {
		return {
			state: this.currentState,
			config: this.config,
		};
	}

	/**
	 * Create a state machine from serialized data.
	 */
	static deserialize<TState extends string, TAction extends string>(
		data: { state: TState; config: StateMachineConfig<TState, TAction> },
	): ContractStateMachine<TState, TAction> {
		return new ContractStateMachine(data.config, data.state);
	}
}

/**
 * Helper to create a state definition.
 */
export function createState<TState extends string>(
	name: TState,
	allowedActions: string[],
	options: { isFinal?: boolean; description?: string } = {},
): StateDefinition<TState> {
	return {
		name,
		allowedActions,
		isFinal: options.isFinal ?? false,
		description: options.description,
	};
}

/**
 * Helper to create a state transition.
 */
export function createTransition<TState extends string, TAction extends string>(
	from: TState | TState[],
	action: TAction,
	to: TState,
	options: {
		guard?: (context: unknown) => boolean;
		guardAsync?: (context: unknown) => Promise<boolean>;
		onTransition?: (context: unknown) => void | Promise<void>;
	} = {},
): StateTransition<TState, TAction> {
	return {
		from,
		action,
		to,
		...options,
	};
}
