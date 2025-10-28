import { Transaction } from "@arkade-os/sdk";
import { base64 } from "@scure/base";

/**
 * Merges the signed checkpoint transactions with the original checkpoint transactions
 * @param signedCheckpointTxs Base64 encoded signed checkpoint transactions
 * @param originalCheckpointTxs Base64 encoded original checkpoint transactions
 */
export function mergeCheckpoints(
	signedCheckpointTxs: string[],
	originalCheckpointTxs: string[],
): Transaction[] {
	// Phase 2: Use the checkpoint transactions signed by each required party
	// (each user signed their checkpoints when they approved)
	const signedCheckpointsDecoded = signedCheckpointTxs.map((_) =>
		Transaction.fromPSBT(base64.decode(_)),
	);
	// this is the one that we mutate and then submit
	const originalCheckpointsDecoded = originalCheckpointTxs.map((_) =>
		Transaction.fromPSBT(base64.decode(_)),
	);

	for (let i = 0; i < originalCheckpointsDecoded.length; i++) {
		const myCheckpointTx = originalCheckpointsDecoded[i];
		const signedCheckpointTx = signedCheckpointsDecoded.find(
			(_) => _.id === myCheckpointTx.id,
		);
		if (!signedCheckpointTx) {
			throw new Error("Signed checkpoint not found");
		}
		// for every input, concatenate its signatures with the signature from the server
		for (let j = 0; j < myCheckpointTx.inputsLength; j++) {
			const input = myCheckpointTx.getInput(j);
			const inputFromServer = signedCheckpointTx.getInput(j);
			if (!inputFromServer.tapScriptSig) throw new Error("No tapScriptSig");
			myCheckpointTx.updateInput(i, {
				tapScriptSig: input.tapScriptSig?.concat(inputFromServer.tapScriptSig),
			});
		}
	}
	return originalCheckpointsDecoded;
}

export function mergeTx(signedTx: string, originalTx: string) {
	const signedTxDecoded = Transaction.fromPSBT(base64.decode(signedTx));
	const originalTxDecoded = Transaction.fromPSBT(base64.decode(originalTx));
	for (let i = 0; i < signedTxDecoded.inputsLength; i++) {
		const input = originalTxDecoded.getInput(i);
		const inputFromServer = signedTxDecoded.getInput(i);
		if (!input.tapScriptSig) throw new Error("No tapScriptSig");
		originalTxDecoded.updateInput(i, {
			tapScriptSig: input.tapScriptSig?.concat(inputFromServer.tapScriptSig!),
		});
	}
	return originalTxDecoded;
}
