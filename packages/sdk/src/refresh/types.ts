/**
 * Refresh Module Types
 *
 * Types for VTXO refresh coordination in ARK protocol.
 * Supports both single-user and multi-party delegation models.
 */

import { XOnlyPubKey } from "../core/types.js";
import { VtxoRef } from "../transactions/types.js";

/**
 * Sighash modes for transaction signing.
 */
export type SigHashMode =
	| "all" // SIGHASH_ALL - standard, commits to all inputs/outputs
	| "acp"; // SIGHASH_ALL | ANYONECANPAY - allows adding inputs later

/**
 * Delegation source configuration.
 *
 * Determines who can act as delegate for refresh operations.
 */
export type DelegateSource =
	| {
			/** Use an existing party from the contract as delegate */
			type: "existing-party";
			/** Roles that can act as delegate (e.g., ["arbiter", "sender"]) */
			roles: string[];
	  }
	| {
			/** Use an external delegate (additional key in script) */
			type: "external";
			/** Public key of the external delegate */
			pubkey: XOnlyPubKey;
	  };

/**
 * Refresh configuration for a contract.
 *
 * Contracts opt-in to refresh support by providing this configuration.
 */
export interface RefreshConfig {
	/** Whether refresh is enabled for this contract */
	enabled: boolean;
	/** Who can act as delegate */
	delegateSource: DelegateSource;
	/**
	 * Warning threshold in blocks before round expiry.
	 * Emit warning when blocks remaining < this value.
	 */
	warningThresholdBlocks?: number;
	/**
	 * Auto-refresh threshold in blocks.
	 * Automatically initiate refresh when blocks remaining < this value.
	 */
	autoRefreshThresholdBlocks?: number;
}

/**
 * Round information for a VTXO.
 */
export interface RoundInfo {
	/** Round identifier */
	roundId: string;
	/** When this round expires */
	expiresAt: Date;
	/** Blocks remaining until expiry */
	blocksRemaining: number;
	/** Whether this VTXO needs refresh soon */
	needsRefresh: boolean;
}

/**
 * Unsigned intent for refresh operation.
 *
 * Intent declares the refresh intention and is signed by all parties.
 */
export interface UnsignedIntent {
	/** VTXOs to be refreshed */
	vtxos: VtxoRef[];
	/** Base64 encoded unsigned intent PSBT */
	psbt: string;
	/** Roles required to sign the intent */
	requiredSigners: string[];
	/** Destination address for new VTXOs (same script, new round) */
	destinationScript: string;
	/** Message encoding the intent details */
	intentMessage: string;
}

/**
 * Partially signed intent from a single party.
 */
export interface SignedIntentPart {
	/** Role of the signer */
	role: string;
	/** Public key of the signer */
	pubkey: XOnlyPubKey;
	/** Base64 encoded signed intent PSBT */
	signedPsbt: string;
}

/**
 * Fully signed intent ready for delegation.
 */
export interface SignedIntent {
	/** Original unsigned intent */
	unsigned: UnsignedIntent;
	/** All collected intent signatures */
	signatures: SignedIntentPart[];
	/** Base64 encoded fully signed intent */
	signedPsbt: string;
}

/**
 * Unsigned forfeit transaction.
 *
 * The forfeit is signed by non-delegate parties using SIGHASH_ACP
 * so the delegate can add the connector input later.
 */
export interface UnsignedForfeit {
	/** The signed intent this forfeit relates to */
	intent: SignedIntent;
	/** Base64 encoded unsigned forfeit PSBT */
	psbt: string;
	/** Roles required to sign (excludes delegate) */
	requiredSigners: string[];
}

/**
 * Partial forfeit signature with ACP sighash.
 */
export interface PartialForfeitSig {
	/** Role of the signer */
	role: string;
	/** Public key of the signer */
	pubkey: XOnlyPubKey;
	/** Base64 encoded partially signed forfeit (ACP) */
	signedPsbt: string;
	/** Sighash mode used (should be "acp") */
	sigHashMode: SigHashMode;
}

/**
 * Package containing everything the delegate needs to execute refresh.
 */
export interface DelegatePackage {
	/** Fully signed intent */
	intent: SignedIntent;
	/** Partial forfeit signatures from non-delegate parties */
	partialForfeits: PartialForfeitSig[];
	/** VTXOs being refreshed */
	vtxos: VtxoRef[];
	/** Role of the delegate executing refresh */
	delegateRole: string;
	/** Public key of the delegate */
	delegatePubkey: XOnlyPubKey;
	/** Timestamp when package was created */
	createdAt: number;
	/** Expiry time for this package (should refresh before this) */
	expiresAt: number;
}

/**
 * Result of executing a refresh operation.
 */
export interface RefreshResult {
	/** Whether the refresh succeeded */
	success: boolean;
	/** New VTXOs created by the refresh */
	newVtxos?: VtxoRef[];
	/** Transaction ID of the refresh */
	txid?: string;
	/** Error message if refresh failed */
	error?: string;
	/** Round ID of the new VTXOs */
	newRoundId?: string;
}

/**
 * Simple refresh request for single-user (owner joins batch directly).
 */
export interface SimpleRefreshRequest {
	/** VTXOs to refresh */
	vtxos: VtxoRef[];
	/** The script/address to refresh to (same as source) */
	destinationScript: string;
	/** Tap tree for the VTXOs */
	tapTree: Uint8Array;
	/** Spending path to use for refresh */
	tapLeafScript: Uint8Array;
}

/**
 * Status of a refresh operation.
 */
export type RefreshStatus =
	| "pending" // Package created, waiting for delegate
	| "registered" // Intent registered with operator
	| "in-batch" // Delegate joined batch, waiting for round
	| "completed" // Refresh successful
	| "failed" // Refresh failed
	| "expired"; // Package expired before refresh

/**
 * Tracked refresh operation.
 */
export interface RefreshOperation {
	/** Unique identifier for this refresh */
	id: string;
	/** Current status */
	status: RefreshStatus;
	/** The delegate package */
	package: DelegatePackage;
	/** Intent ID (after registration) */
	intentId?: string;
	/** Result (after completion) */
	result?: RefreshResult;
	/** Timestamps */
	timestamps: {
		created: number;
		registered?: number;
		inBatch?: number;
		completed?: number;
	};
}

/**
 * Callback for refresh events.
 */
export interface RefreshEventCallbacks {
	/** Called when VTXOs approach expiry */
	onRefreshWarning?: (vtxos: VtxoRef[], blocksRemaining: number) => void;
	/** Called when refresh is needed (critical threshold) */
	onRefreshNeeded?: (vtxos: VtxoRef[], blocksRemaining: number) => void;
	/** Called when refresh completes */
	onRefreshComplete?: (result: RefreshResult) => void;
	/** Called when refresh fails */
	onRefreshFailed?: (error: Error) => void;
}

/**
 * Signer interface for refresh operations.
 */
export interface RefreshSigner {
	/** Get the signer's public key */
	getPublicKey(): XOnlyPubKey;
	/** Get the signer's role */
	getRole(): string;
	/**
	 * Sign a PSBT.
	 * @param psbt Base64 encoded PSBT
	 * @param sigHashMode Sighash mode to use
	 * @returns Base64 encoded signed PSBT
	 */
	sign(psbt: string, sigHashMode?: SigHashMode): Promise<string>;
}

/**
 * Error thrown during refresh operations.
 */
export class RefreshError extends Error {
	constructor(
		message: string,
		public readonly code?: RefreshErrorCode,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "RefreshError";
	}
}

/**
 * Error codes for refresh operations.
 */
export type RefreshErrorCode =
	| "NOT_CONFIGURED" // Refresh not enabled for contract
	| "INVALID_DELEGATE" // Invalid delegate for this contract
	| "MISSING_SIGNATURES" // Not all required signatures collected
	| "INVALID_SIGNATURE" // Signature verification failed
	| "PACKAGE_EXPIRED" // Delegate package has expired
	| "INTENT_FAILED" // Intent registration failed
	| "BATCH_FAILED" // Failed to join batch
	| "ROUND_EXPIRED" // Round expired during refresh
	| "VTXO_NOT_FOUND" // VTXO no longer exists
	| "INVALID_SIGHASH"; // Wrong sighash mode used
