/**
 * Escrow Module Types
 *
 * Types specific to the escrow contract module.
 */

import { Party, Timelock, XOnlyPubKey } from "../../core/types.js";
import { VtxoRef } from "../../transactions/types.js";

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
};
