/**
 * Signature utilities - Now re-exported from @arkade-escrow/sdk
 *
 * These utilities are used for merging Schnorr signatures from multiple
 * parties into a single PSBT ready for broadcast.
 */

import { Transaction } from "@arkade-os/sdk";
import {
	mergeTx as sdkMergeTx,
	mergeCheckpoints as sdkMergeCheckpoints,
} from "@arkade-escrow/sdk";

/**
 * Merges the signed checkpoint transactions with the original checkpoint transactions
 * @param signedCheckpointTxs Base64 encoded signed checkpoint transactions
 * @param originalCheckpointTxs Base64 encoded original checkpoint transactions
 */
export function mergeCheckpoints(
	signedCheckpointTxs: string[],
	originalCheckpointTxs: string[],
): Transaction[] {
	return sdkMergeCheckpoints(signedCheckpointTxs, originalCheckpointTxs);
}

/**
 * Merges signatures from a signed transaction into an original transaction
 * @param signedTx Base64 encoded signed PSBT
 * @param originalTx Base64 encoded original PSBT
 */
export function mergeTx(signedTx: string, originalTx: string): Transaction {
	return sdkMergeTx(signedTx, originalTx);
}
