/**
 * Signature Merger utilities
 *
 * Utilities for merging Schnorr signatures from multiple parties
 * into a single PSBT ready for broadcast.
 */

import { Transaction } from "@arkade-os/sdk";
import { base64 } from "@scure/base";
import { TransactionError } from "./types.js";

/**
 * Merge signatures from a signed transaction into an original transaction.
 *
 * This function takes two PSBTs - one with accumulated signatures and one
 * with new signatures - and merges them together by concatenating the
 * tapScriptSig entries for each input.
 *
 * @param signedPsbt - Base64 encoded PSBT with new signatures
 * @param originalPsbt - Base64 encoded PSBT with existing signatures
 * @returns The merged Transaction object
 */
export function mergeTx(signedPsbt: string, originalPsbt: string): Transaction {
	const signedTx = Transaction.fromPSBT(base64.decode(signedPsbt));
	const originalTx = Transaction.fromPSBT(base64.decode(originalPsbt));

	for (let i = 0; i < signedTx.inputsLength; i++) {
		const originalInput = originalTx.getInput(i);
		const signedInput = signedTx.getInput(i);

		if (!originalInput.tapScriptSig || !signedInput.tapScriptSig) {
			throw new TransactionError(
				"Cannot merge signatures: missing tapScriptSig",
				"MISSING_SIGNATURE",
				{ inputIndex: i },
			);
		}

		originalTx.updateInput(i, {
			tapScriptSig: originalInput.tapScriptSig.concat(signedInput.tapScriptSig),
		});
	}

	return originalTx;
}

/**
 * Merge signatures from a signed PSBT into an original PSBT.
 * Returns the merged result as a base64 string.
 *
 * @param signedPsbt - Base64 encoded PSBT with new signatures
 * @param originalPsbt - Base64 encoded PSBT with existing signatures
 * @returns Base64 encoded merged PSBT
 */
export function mergePsbt(signedPsbt: string, originalPsbt: string): string {
	const merged = mergeTx(signedPsbt, originalPsbt);
	return base64.encode(merged.toPSBT());
}

/**
 * Merge checkpoint transactions.
 *
 * ARK uses checkpoint transactions for its virtual UTXO model. Each party
 * must sign their checkpoints, and these signatures need to be merged.
 *
 * @param signedCheckpoints - Base64 encoded signed checkpoint PSBTs
 * @param originalCheckpoints - Base64 encoded original checkpoint PSBTs
 * @returns Array of merged Transaction objects
 */
export function mergeCheckpoints(
	signedCheckpoints: string[],
	originalCheckpoints: string[],
): Transaction[] {
	if (signedCheckpoints.length !== originalCheckpoints.length) {
		throw new TransactionError(
			"Checkpoint count mismatch",
			"CHECKPOINT_MISMATCH",
			{
				signed: signedCheckpoints.length,
				original: originalCheckpoints.length,
			},
		);
	}

	const signedDecoded = signedCheckpoints.map((cp) =>
		Transaction.fromPSBT(base64.decode(cp)),
	);
	const originalDecoded = originalCheckpoints.map((cp) =>
		Transaction.fromPSBT(base64.decode(cp)),
	);

	for (let i = 0; i < originalDecoded.length; i++) {
		const originalCp = originalDecoded[i];
		const signedCp = signedDecoded.find((cp) => cp.id === originalCp.id);

		if (!signedCp) {
			throw new TransactionError(
				`Signed checkpoint not found for ID ${originalCp.id}`,
				"CHECKPOINT_NOT_FOUND",
				{ checkpointId: originalCp.id },
			);
		}

		// Merge signatures for each input in this checkpoint
		for (let j = 0; j < originalCp.inputsLength; j++) {
			const originalInput = originalCp.getInput(j);
			const signedInput = signedCp.getInput(j);

			if (!signedInput.tapScriptSig) {
				throw new TransactionError(
					"Missing tapScriptSig in signed checkpoint",
					"MISSING_CHECKPOINT_SIGNATURE",
					{ checkpointIndex: i, inputIndex: j },
				);
			}

			originalCp.updateInput(j, {
				tapScriptSig: originalInput.tapScriptSig?.concat(
					signedInput.tapScriptSig,
				),
			});
		}
	}

	return originalDecoded;
}

/**
 * Merge checkpoint transactions and return as base64 strings.
 *
 * @param signedCheckpoints - Base64 encoded signed checkpoint PSBTs
 * @param originalCheckpoints - Base64 encoded original checkpoint PSBTs
 * @returns Array of base64 encoded merged checkpoint PSBTs
 */
export function mergeCheckpointsPsbt(
	signedCheckpoints: string[],
	originalCheckpoints: string[],
): string[] {
	const merged = mergeCheckpoints(signedCheckpoints, originalCheckpoints);
	return merged.map((tx) => base64.encode(tx.toPSBT()));
}

/**
 * Count the number of signatures in a PSBT input.
 */
export function countSignatures(psbt: string, inputIndex = 0): number {
	const tx = Transaction.fromPSBT(base64.decode(psbt));
	const input = tx.getInput(inputIndex);
	return input.tapScriptSig?.length ?? 0;
}

/**
 * Check if a PSBT has all required signatures for a given threshold.
 */
export function hasRequiredSignatures(
	psbt: string,
	requiredCount: number,
	inputIndex = 0,
): boolean {
	return countSignatures(psbt, inputIndex) >= requiredCount;
}
