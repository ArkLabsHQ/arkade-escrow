/**
 * Escrow Module Types
 *
 * Types specific to the escrow contract module.
 */

import { Party, Timelock, XOnlyPubKey } from "../../core/types.js";
import { VtxoRef } from "../../transactions/types.js";
import { RefreshConfig, DelegateSource } from "../../refresh/types.js";

/**
 * Escrow-specific roles.
 */
export type EscrowRole = "sender" | "receiver" | "arbiter" | "server";

/**
 * Escrow contract states.
 *
 * Lifecycle:
 * - draft: Contract created but not accepted by counterparty
 * - created: Accepted, waiting for funding
 * - funded: Funded, ready for execution
 * - pending-execution: Execution in progress, collecting signatures
 * - completed: Successfully executed
 * - disputed: Under arbitration
 * - canceled: Canceled before funding
 * - voided: Voided by arbiter
 */
export type EscrowState =
	| "draft"
	| "created"
	| "funded"
	| "pending-execution"
	| "completed"
	| "disputed"
	| "canceled"
	| "voided";

/**
 * Escrow contract actions.
 */
export type EscrowAction =
	| "accept" // Counterparty accepts the contract
	| "reject" // Counterparty rejects the contract
	| "cancel" // Creator cancels the contract
	| "fund" // Contract receives funding
	| "release" // Release funds to receiver (arbiter decision)
	| "refund" // Refund funds to sender (arbiter decision)
	| "settle" // Direct settlement between sender and receiver
	| "dispute" // Open a dispute
	| "void" // Arbiter voids the contract
	| "unilateral-release" // Timelocked release
	| "unilateral-refund" // Timelocked refund
	| "unilateral-settle"; // Timelocked settlement

/**
 * Escrow execution actions (the subset that require transactions).
 */
export type EscrowExecutionAction =
	| "release"
	| "refund"
	| "settle"
	| "unilateral-release"
	| "unilateral-refund"
	| "unilateral-settle";

/**
 * Configuration for creating an escrow contract.
 */
export interface EscrowConfig {
	/** Sender party (the one funding the escrow) */
	sender: Party;
	/** Receiver party (the one receiving funds on success) */
	receiver: Party;
	/** Arbiter party (dispute resolver - optional, defaults to server) */
	arbiter?: Party;
	/** Protocol server public key */
	serverPubkey: XOnlyPubKey;
	/** Timelock for unilateral exit paths */
	unilateralDelay: Timelock;
	/** Amount to be escrowed in satoshis */
	amount: number;
	/** Description of the escrow purpose */
	description?: string;
	/** Unique nonce for address generation */
	nonce?: string;
	/** Pre-set receiver address for automatic release */
	receiverAddress?: string;
	/** Pre-set sender address for automatic refund */
	senderAddress?: string;
	/** Refresh configuration (optional) */
	refresh?: EscrowRefreshConfig;
}

/**
 * Refresh configuration specific to escrow contracts.
 *
 * For escrow, the delegate is typically one of the existing parties
 * (sender, receiver, or arbiter) rather than an external service.
 */
export interface EscrowRefreshConfig {
	/** Whether refresh is enabled */
	enabled: boolean;
	/**
	 * Who can act as delegate.
	 * Default: "any-party" (any of sender/receiver/arbiter)
	 */
	delegatePolicy?: "any-party" | "arbiter-only" | "external";
	/**
	 * External delegate pubkey (only if delegatePolicy is "external")
	 */
	externalDelegatePubkey?: XOnlyPubKey;
	/**
	 * Warning threshold in blocks before round expiry
	 */
	warningThresholdBlocks?: number;
	/**
	 * Auto-refresh threshold in blocks
	 */
	autoRefreshThresholdBlocks?: number;
}

/**
 * Convert escrow refresh config to SDK RefreshConfig.
 */
export function toSdkRefreshConfig(
	escrowConfig: EscrowRefreshConfig | undefined,
): RefreshConfig | null {
	if (!escrowConfig?.enabled) return null;

	let delegateSource: DelegateSource;

	switch (escrowConfig.delegatePolicy) {
		case "arbiter-only":
			delegateSource = { type: "existing-party", roles: ["arbiter"] };
			break;
		case "external":
			if (!escrowConfig.externalDelegatePubkey) {
				throw new Error("External delegate policy requires externalDelegatePubkey");
			}
			delegateSource = { type: "external", pubkey: escrowConfig.externalDelegatePubkey };
			break;
		case "any-party":
		default:
			delegateSource = { type: "existing-party", roles: ["sender", "receiver", "arbiter"] };
			break;
	}

	return {
		enabled: true,
		delegateSource,
		warningThresholdBlocks: escrowConfig.warningThresholdBlocks,
		autoRefreshThresholdBlocks: escrowConfig.autoRefreshThresholdBlocks,
	};
}

/**
 * Escrow contract data.
 */
export interface EscrowData {
	/** Sender party */
	sender: Party;
	/** Receiver party */
	receiver: Party;
	/** Arbiter party */
	arbiter: Party;
	/** Required amount in satoshis */
	amount: number;
	/** Description */
	description?: string;
	/** Current funded amount in satoshis */
	fundedAmount: number;
	/** VTXOs that funded this escrow */
	vtxos: VtxoRef[];
	/** Receiver's destination address */
	receiverAddress?: string;
	/** Sender's refund address */
	senderAddress?: string;
	/** The escrow address */
	escrowAddress?: string;
	/** Nonce used for address uniqueness */
	nonce?: string;
}

/**
 * Escrow execution request.
 */
export interface EscrowExecutionRequest {
	/** The action to execute */
	action: EscrowExecutionAction;
	/** Destination address for funds */
	destinationAddress: string;
	/** Optional: specific amount (defaults to full balance) */
	amount?: number;
	/** Optional: reason for the action */
	reason?: string;
}

/**
 * Escrow dispute information.
 */
export interface EscrowDispute {
	/** Who opened the dispute */
	claimantRole: "sender" | "receiver";
	/** Who is being disputed against */
	defendantRole: "sender" | "receiver";
	/** Reason for the dispute */
	reason: string;
	/** When the dispute was opened */
	openedAt: number;
	/** Resolution (if any) */
	resolution?: {
		action: "release" | "refund";
		resolvedAt: number;
		resolvedBy: string;
	};
}

/**
 * Mapping from execution actions to spending paths.
 */
export const ACTION_TO_PATH: Record<EscrowExecutionAction, string> = {
	release: "release",
	refund: "refund",
	settle: "settle",
	"unilateral-release": "unilateral-release",
	"unilateral-refund": "unilateral-refund",
	"unilateral-settle": "unilateral-settle",
};

/**
 * Mapping from spending paths to required signers.
 */
export const PATH_TO_SIGNERS: Record<string, EscrowRole[]> = {
	release: ["receiver", "arbiter", "server"],
	refund: ["sender", "arbiter", "server"],
	settle: ["sender", "receiver", "server"],
	"unilateral-release": ["receiver", "arbiter"],
	"unilateral-refund": ["sender", "arbiter"],
	"unilateral-settle": ["sender", "receiver"],
	// Refresh path - all non-server parties sign (one acts as delegate)
	refresh: ["sender", "receiver", "arbiter", "server"],
};
