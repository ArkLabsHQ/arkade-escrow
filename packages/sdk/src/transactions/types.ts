/**
 * Transaction layer types
 *
 * Types for building, signing, and coordinating multi-party transactions.
 */

import { SpendingPath, XOnlyPubKey } from "../core/types.js";

/**
 * VTXO (Virtual Transaction Output) reference.
 * Represents a spendable output in the ARK protocol.
 */
export interface VtxoRef {
	/** Transaction ID containing this output */
	txid: string;
	/** Output index within the transaction */
	vout: number;
	/** Value in satoshis */
	value: number;
}

/**
 * Transaction output definition.
 */
export interface TxOutput {
	/** Recipient address (bech32m) */
	address: string;
	/** Amount in satoshis */
	amount: bigint;
	/** Optional script for advanced outputs */
	script?: Uint8Array;
}

/**
 * Input for transaction building.
 */
export interface TxInput {
	/** VTXO reference being spent */
	vtxo: VtxoRef;
	/** The tap tree for this input */
	tapTree: Uint8Array;
	/** The spending path being used */
	tapLeafScript: Uint8Array;
}

/**
 * Unsigned transaction ready for signing.
 */
export interface UnsignedTransaction {
	/** Base64 encoded PSBT */
	psbt: string;
	/** The spending path being used */
	spendingPath: SpendingPath;
	/** Inputs being spent */
	inputs: VtxoRef[];
	/** Outputs being created */
	outputs: TxOutput[];
	/** Roles required to sign (by role name) */
	requiredSigners: string[];
}

/**
 * Signature from a single party.
 */
export interface PartySignature {
	/** The role of the signer */
	role: string;
	/** The signer's public key */
	pubkey: XOnlyPubKey;
	/** Base64 encoded signed PSBT */
	signedPsbt: string;
}

/**
 * Clean transaction as prepared by the server/coordinator.
 * This is the state before any user signatures are applied.
 */
export interface CleanTransaction {
	/** The VTXO being spent */
	vtxo: VtxoRef;
	/** Base64 encoded unsigned ARK transaction (PSBT) */
	arkTx: string;
	/** Base64 encoded checkpoint transactions (PSBTs) */
	checkpoints: string[];
	/** Roles required to sign */
	requiredSigners: string[];
	/** Public keys that have approved (signed) */
	approvedByPubKeys: string[];
	/** Public keys that have rejected */
	rejectedByPubKeys: string[];
}

/**
 * Signed transaction after all parties have signed.
 */
export interface SignedTransaction {
	/** Base64 encoded finalized ARK transaction (PSBT) */
	arkTx: string;
	/** Base64 encoded signed checkpoint transactions (PSBTs) */
	checkpoints: string[];
}

/**
 * Partially signed transaction during the signing process.
 */
export interface PartiallySignedTransaction {
	/** The unsigned transaction */
	unsigned: UnsignedTransaction;
	/** Signatures collected so far */
	signatures: PartySignature[];
	/** Checkpoints for ARK protocol (base64 encoded) */
	checkpoints?: string[];
	/** Signed checkpoints (merged as signatures are added) */
	signedCheckpoints?: string[];
}

/**
 * Signing status for a transaction.
 */
export interface SigningStatus {
	/** The partially signed transaction */
	transaction: PartiallySignedTransaction;
	/** Roles that still need to sign */
	pendingSigners: string[];
	/** Roles that have signed */
	completedSigners: string[];
	/** Whether all required signatures are present */
	isComplete: boolean;
}

/**
 * Result of submitting a transaction to the protocol.
 */
export interface SubmitResult {
	/** Transaction ID */
	txid: string;
	/** Server-signed checkpoints (ARK-specific) */
	signedCheckpoints?: string[];
	/** Whether the transaction was finalized */
	finalized: boolean;
}

/**
 * Error thrown during transaction operations.
 */
export class TransactionError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "TransactionError";
	}
}
