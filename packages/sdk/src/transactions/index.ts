/**
 * Transactions module - PSBT building and multi-party signing
 *
 * This module provides utilities for building transactions, coordinating
 * multi-party signing, and merging signatures.
 */

// Types
export type {
	VtxoRef,
	TxOutput,
	TxInput,
	UnsignedTransaction,
	PartySignature,
	CleanTransaction,
	SignedTransaction,
	PartiallySignedTransaction,
	SigningStatus,
	SubmitResult,
} from "./types.js";

export { TransactionError } from "./types.js";

// Signature merging utilities
export {
	mergeTx,
	mergePsbt,
	mergeCheckpoints,
	mergeCheckpointsPsbt,
	countSignatures,
	hasRequiredSignatures,
} from "./signature-merger.js";

// Signing coordinator
export {
	SigningCoordinator,
	createSigningCoordinator,
} from "./signing-coordinator.js";
