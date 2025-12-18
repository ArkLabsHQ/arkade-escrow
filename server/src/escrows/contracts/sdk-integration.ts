/**
 * SDK Integration Layer
 *
 * Bridges the existing TypeORM entity structure with the @arkade-escrow/sdk primitives.
 * This provides:
 * - State machine validation
 * - SDK type mappings
 * - Signing coordination helpers
 */

import {
	ContractStateMachine,
	ESCROW_STATE_MACHINE,
	EscrowState,
	EscrowAction,
	EscrowExecutionAction,
	getEscrowSignersForPath,
	ACTION_TO_PATH,
	isCollaborativePath,
	isTimelockedPath,
	VtxoRef,
	SigningCoordinator,
	UnsignedTransaction,
	createSigningCoordinator,
} from "@arkade-escrow/sdk";
import { ContractStatus, EscrowContract } from "./escrow-contract.entity";
import { Signers } from "../../ark/escrow";

/**
 * Map current entity status to SDK EscrowState.
 * The SDK has a simpler state model, so some statuses map to the same SDK state.
 */
export function mapStatusToSdkState(status: ContractStatus): EscrowState {
	switch (status) {
		case "draft":
			return "draft";
		case "created":
			return "created";
		case "funded":
			return "funded";
		case "pending-execution":
			return "pending-execution";
		case "completed":
			return "completed";
		case "canceled-by-creator":
		case "rejected-by-counterparty":
		case "rescinded-by-creator":
		case "rescinded-by-counterparty":
			return "canceled";
		case "voided-by-arbiter":
			return "voided";
		case "under-arbitration":
			return "disputed";
		default:
			throw new Error(`Unknown status: ${status}`);
	}
}

/**
 * Map SDK EscrowState back to a default entity status.
 * Note: SDK states are more generic, so this returns a default.
 */
export function mapSdkStateToStatus(state: EscrowState): ContractStatus {
	switch (state) {
		case "draft":
			return "draft";
		case "created":
			return "created";
		case "funded":
			return "funded";
		case "pending-execution":
			return "pending-execution";
		case "completed":
			return "completed";
		case "canceled":
			return "canceled-by-creator"; // Default, caller should specify
		case "voided":
			return "voided-by-arbiter";
		case "disputed":
			return "under-arbitration";
		default:
			throw new Error(`Unknown SDK state: ${state}`);
	}
}

/**
 * Map current execution action to SDK action.
 */
export function mapExecutionActionToSdkAction(
	action: "direct-settle" | "release-funds" | "return-funds",
): EscrowExecutionAction {
	switch (action) {
		case "direct-settle":
			return "settle";
		case "release-funds":
			return "release";
		case "return-funds":
			return "refund";
		default:
			throw new Error(`Unknown execution action: ${action}`);
	}
}

/**
 * Map SDK action back to entity action type.
 */
export function mapSdkActionToExecutionAction(
	action: EscrowExecutionAction,
): "direct-settle" | "release-funds" | "return-funds" {
	switch (action) {
		case "settle":
			return "direct-settle";
		case "release":
		case "unilateral-release":
			return "release-funds";
		case "refund":
		case "unilateral-refund":
			return "return-funds";
		case "unilateral-settle":
			return "direct-settle";
		default:
			throw new Error(`Unknown SDK action: ${action}`);
	}
}

/**
 * Map SDK signer roles to entity Signers type.
 */
export function mapSdkRolesToSigners(roles: string[]): Signers[] {
	return roles.map((role) => {
		switch (role) {
			case "sender":
				return "sender";
			case "receiver":
				return "receiver";
			case "arbiter":
			case "arbitrator":
				return "arbitrator";
			case "server":
				return "server";
			default:
				throw new Error(`Unknown SDK role: ${role}`);
		}
	});
}

/**
 * Create an SDK state machine initialized to the contract's current state.
 */
export function createStateMachineForContract(
	contract: EscrowContract,
): ContractStateMachine<EscrowState, EscrowAction> {
	const sdkState = mapStatusToSdkState(contract.status);
	return new ContractStateMachine(ESCROW_STATE_MACHINE, sdkState);
}

/**
 * Check if an action is allowed for the contract's current state.
 */
export function canPerformAction(
	contract: EscrowContract,
	action: EscrowAction,
): boolean {
	const stateMachine = createStateMachineForContract(contract);
	return stateMachine.canPerform(action);
}

/**
 * Get all allowed actions for the contract's current state.
 */
export function getAllowedActions(contract: EscrowContract): EscrowAction[] {
	const stateMachine = createStateMachineForContract(contract);
	return stateMachine.getAllowedActions() as EscrowAction[];
}

/**
 * Preview what state would result from an action.
 */
export function previewStateTransition(
	contract: EscrowContract,
	action: EscrowAction,
): EscrowState | undefined {
	const stateMachine = createStateMachineForContract(contract);
	return stateMachine.previewTransition(action);
}

/**
 * Get the required signers for an execution action.
 */
export function getRequiredSignersForAction(
	action: EscrowExecutionAction,
): Signers[] {
	const pathName = ACTION_TO_PATH[action];
	const sdkRoles = getEscrowSignersForPath(pathName);
	return mapSdkRolesToSigners(sdkRoles);
}

/**
 * Check if an action requires server participation.
 */
export function requiresServerSignature(action: EscrowExecutionAction): boolean {
	const pathName = ACTION_TO_PATH[action];
	return isCollaborativePath(pathName);
}

/**
 * Check if an action is timelocked (unilateral exit).
 */
export function isUnilateralAction(action: EscrowExecutionAction): boolean {
	const pathName = ACTION_TO_PATH[action];
	return isTimelockedPath(pathName);
}

/**
 * Convert entity virtual coins to SDK VtxoRef format.
 */
export function toSdkVtxoRefs(
	virtualCoins: Array<{ txid: string; vout: number; value: number }> | undefined,
): VtxoRef[] {
	if (!virtualCoins) return [];
	return virtualCoins.map((coin) => ({
		txid: coin.txid,
		vout: coin.vout,
		value: coin.value,
	}));
}

/**
 * EscrowStateMachineGuard - Validates state transitions using SDK state machine.
 *
 * Use this to validate transitions before performing them.
 */
export class EscrowStateMachineGuard {
	private stateMachine: ContractStateMachine<EscrowState, EscrowAction>;

	constructor(contract: EscrowContract) {
		this.stateMachine = createStateMachineForContract(contract);
	}

	/**
	 * Check if action is allowed from current state.
	 */
	canPerform(action: EscrowAction): boolean {
		return this.stateMachine.canPerform(action);
	}

	/**
	 * Get allowed actions.
	 */
	getAllowedActions(): EscrowAction[] {
		return this.stateMachine.getAllowedActions() as EscrowAction[];
	}

	/**
	 * Validate and perform transition, returning the new SDK state.
	 * Throws if transition is not allowed.
	 */
	async performTransition(action: EscrowAction): Promise<EscrowState> {
		return this.stateMachine.perform(action);
	}

	/**
	 * Get the current SDK state.
	 */
	getState(): EscrowState {
		return this.stateMachine.getState();
	}

	/**
	 * Check if contract is in a final state.
	 */
	isFinal(): boolean {
		return this.stateMachine.isFinal();
	}
}

/**
 * ExecutionSigningTracker - Tracks signing progress using SDK patterns.
 */
export class ExecutionSigningTracker {
	private requiredSigners: Set<Signers>;
	private completedSigners: Set<string>;

	constructor(action: EscrowExecutionAction) {
		this.requiredSigners = new Set(getRequiredSignersForAction(action));
		this.completedSigners = new Set();
	}

	/**
	 * Get the list of signers required for this execution.
	 */
	getRequiredSigners(): Signers[] {
		return Array.from(this.requiredSigners);
	}

	/**
	 * Mark a signer as having signed.
	 */
	addSigner(pubkey: string, role: Signers): boolean {
		if (!this.requiredSigners.has(role)) {
			return false;
		}
		this.completedSigners.add(pubkey);
		return true;
	}

	/**
	 * Check if all required signatures have been collected.
	 */
	isComplete(approvedByPubKeys: string[], signerRoles: Map<string, Signers>): boolean {
		const completedRoles = new Set<Signers>();
		for (const pubkey of approvedByPubKeys) {
			const role = signerRoles.get(pubkey);
			if (role && this.requiredSigners.has(role)) {
				completedRoles.add(role);
			}
		}
		return completedRoles.size === this.requiredSigners.size;
	}

	/**
	 * Get the list of roles that still need to sign.
	 */
	getPendingSigners(approvedByPubKeys: string[], signerRoles: Map<string, Signers>): Signers[] {
		const completedRoles = new Set<Signers>();
		for (const pubkey of approvedByPubKeys) {
			const role = signerRoles.get(pubkey);
			if (role) completedRoles.add(role);
		}
		return Array.from(this.requiredSigners).filter((r) => !completedRoles.has(r));
	}
}

/**
 * Create SDK SigningCoordinator from execution transaction data.
 */
export function createSigningCoordinatorFromExecution(
	cleanTransaction: {
		vtxo: { txid: string; vout: number; value: number };
		arkTx: string;
		checkpoints: string[];
		requiredSigners: Signers[];
	},
	action: EscrowExecutionAction,
): SigningCoordinator {
	const sdkAction = ACTION_TO_PATH[action];
	return createSigningCoordinator(
		{
			vtxo: cleanTransaction.vtxo,
			arkTx: cleanTransaction.arkTx,
			checkpoints: cleanTransaction.checkpoints,
			requiredSigners: cleanTransaction.requiredSigners,
		},
		sdkAction,
	);
}

/**
 * ExecutionCoordinator - Wraps SDK SigningCoordinator for entity integration.
 *
 * This class provides a higher-level interface that works with the existing
 * ContractExecution entity structure while leveraging SDK signing coordination.
 */
export class ExecutionCoordinator {
	private tracker: ExecutionSigningTracker;
	private signerRoles: Map<string, Signers>;

	constructor(
		private readonly action: EscrowExecutionAction,
		private readonly contract: EscrowContract,
		private readonly arbitratorPubkey: string,
	) {
		this.tracker = new ExecutionSigningTracker(action);
		this.signerRoles = this.buildSignerRolesMap();
	}

	/**
	 * Build a map from pubkey to signer role.
	 */
	private buildSignerRolesMap(): Map<string, Signers> {
		const map = new Map<string, Signers>();
		map.set(this.contract.senderPubkey, "sender");
		map.set(this.contract.receiverPubkey, "receiver");
		map.set(this.arbitratorPubkey, "arbitrator");
		// Server pubkey would be added by the service
		return map;
	}

	/**
	 * Get the required signers for this execution.
	 */
	getRequiredSigners(): Signers[] {
		return this.tracker.getRequiredSigners();
	}

	/**
	 * Check if a pubkey is a required signer.
	 */
	isRequiredSigner(pubkey: string): boolean {
		const role = this.signerRoles.get(pubkey);
		if (!role) return false;
		return this.tracker.getRequiredSigners().includes(role);
	}

	/**
	 * Get the role for a pubkey.
	 */
	getRoleForPubkey(pubkey: string): Signers | undefined {
		return this.signerRoles.get(pubkey);
	}

	/**
	 * Check if all required signatures have been collected.
	 */
	isComplete(approvedByPubKeys: string[]): boolean {
		return this.tracker.isComplete(approvedByPubKeys, this.signerRoles);
	}

	/**
	 * Get the list of roles that still need to sign.
	 */
	getPendingSigners(approvedByPubKeys: string[]): Signers[] {
		return this.tracker.getPendingSigners(approvedByPubKeys, this.signerRoles);
	}

	/**
	 * Check if this execution requires server participation.
	 */
	requiresServer(): boolean {
		return requiresServerSignature(this.action);
	}

	/**
	 * Check if this is a unilateral (timelocked) action.
	 */
	isUnilateral(): boolean {
		return isUnilateralAction(this.action);
	}

	/**
	 * Get pubkeys that need to sign based on required roles.
	 */
	getRequiredPubkeys(): string[] {
		const requiredRoles = this.getRequiredSigners();
		const pubkeys: string[] = [];

		for (const role of requiredRoles) {
			switch (role) {
				case "sender":
					pubkeys.push(this.contract.senderPubkey);
					break;
				case "receiver":
					pubkeys.push(this.contract.receiverPubkey);
					break;
				case "arbitrator":
					pubkeys.push(this.arbitratorPubkey);
					break;
				// Server is handled separately
			}
		}

		return pubkeys;
	}
}

/**
 * Validate that a state transition is allowed using the SDK state machine.
 *
 * @returns true if the transition is valid, throws otherwise
 */
export function validateStateTransition(
	contract: EscrowContract,
	action: EscrowAction,
): void {
	const guard = new EscrowStateMachineGuard(contract);
	if (!guard.canPerform(action)) {
		const currentState = guard.getState();
		const allowedActions = guard.getAllowedActions();
		throw new Error(
			`Cannot perform action "${action}" from state "${currentState}". ` +
				`Allowed actions: ${allowedActions.join(", ") || "none"}`,
		);
	}
}

/**
 * Get the next state for a given action from the current contract state.
 */
export function getNextState(
	contract: EscrowContract,
	action: EscrowAction,
): EscrowState | undefined {
	return previewStateTransition(contract, action);
}

/**
 * Map an SDK EscrowAction to the specific ContractStatus for cancellation actions.
 *
 * These actions need special handling because the SDK has a single "canceled"
 * state but the entity has multiple cancellation statuses.
 *
 * Note: SDK actions are different from app-level actions. The app has "rescind"
 * and "resolve" which don't exist in the SDK. We map these appropriately.
 */
export function getCancellationStatus(
	action: string,
	isCreator: boolean,
): ContractStatus {
	if (action === "cancel" || action === "reject") {
		return isCreator ? "canceled-by-creator" : "rejected-by-counterparty";
	}
	// "rescind" is an app-level action for backing out after accept but before funding
	// In SDK terms this is still a "cancel" action
	if (action === "rescind") {
		return isCreator ? "rescinded-by-creator" : "rescinded-by-counterparty";
	}
	// For other actions that lead to voided state
	if (action === "void") {
		return "voided-by-arbiter";
	}
	// Default fallback
	return mapSdkStateToStatus("canceled");
}

/**
 * Check if a dispute-related action can be performed.
 *
 * The SDK's "dispute" action moves to disputed state.
 * After dispute is resolved (app-level), the contract transitions
 * via "release" or "refund" actions.
 *
 * @param contract The contract to check
 * @param appAction App-level action: "dispute" | "resolve"
 * @returns Whether the action is allowed
 */
export function canPerformDisputeAction(
	contract: EscrowContract,
	appAction: "dispute" | "resolve",
): boolean {
	const guard = new EscrowStateMachineGuard(contract);

	if (appAction === "dispute") {
		// SDK "dispute" action moves to disputed state
		return guard.canPerform("dispute");
	}

	if (appAction === "resolve") {
		// Resolution happens from "disputed" state via release/refund
		// Check if we're in disputed state and can release or refund
		const state = guard.getState();
		return state === "disputed";
	}

	return false;
}
