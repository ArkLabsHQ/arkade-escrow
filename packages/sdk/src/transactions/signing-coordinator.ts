/**
 * Signing Coordinator
 *
 * Coordinates multi-party signing for transactions. Manages the flow of
 * collecting signatures from multiple parties and merging them into
 * a final transaction ready for broadcast.
 */

import {
	UnsignedTransaction,
	PartiallySignedTransaction,
	PartySignature,
	SigningStatus,
	TransactionError,
} from "./types.js";
import {
	mergePsbt,
	mergeCheckpointsPsbt,
	countSignatures,
} from "./signature-merger.js";

/**
 * Coordinates multi-party signing for transactions.
 *
 * The SigningCoordinator manages the process of collecting signatures from
 * multiple parties and merging them into a final transaction. It tracks
 * which parties have signed and provides status information.
 *
 * @example
 * ```typescript
 * // Create coordinator with unsigned transaction
 * const coordinator = new SigningCoordinator(unsignedTx, checkpoints);
 *
 * // Each party signs
 * const senderSigned = await senderWallet.sign(coordinator.getUnsignedPsbt());
 * coordinator.addSignature({ role: "sender", pubkey: senderKey, signedPsbt: senderSigned });
 *
 * const receiverSigned = await receiverWallet.sign(coordinator.getUnsignedPsbt());
 * coordinator.addSignature({ role: "receiver", pubkey: receiverKey, signedPsbt: receiverSigned });
 *
 * // Check if complete
 * if (coordinator.isComplete()) {
 *   const { psbt, checkpoints } = coordinator.getSignedTransaction();
 *   await protocol.submit(psbt, checkpoints);
 * }
 * ```
 */
export class SigningCoordinator {
	private transaction: PartiallySignedTransaction;
	private currentPsbt: string;
	private currentCheckpoints?: string[];

	constructor(unsigned: UnsignedTransaction, checkpoints?: string[]) {
		this.transaction = {
			unsigned,
			signatures: [],
			checkpoints,
			signedCheckpoints: checkpoints ? [...checkpoints] : undefined,
		};
		this.currentPsbt = unsigned.psbt;
		this.currentCheckpoints = checkpoints ? [...checkpoints] : undefined;
	}

	/**
	 * Get the unsigned transaction for signing.
	 *
	 * Parties should sign this PSBT and return the signed version
	 * via addSignature().
	 */
	getUnsignedTransaction(): UnsignedTransaction {
		return this.transaction.unsigned;
	}

	/**
	 * Get the PSBT to sign (base64 encoded).
	 *
	 * This returns the current state of the PSBT with any existing
	 * signatures already merged. New signers should sign this.
	 */
	getUnsignedPsbt(): string {
		return this.currentPsbt;
	}

	/**
	 * Get the checkpoints to sign (ARK-specific).
	 */
	getCheckpoints(): string[] | undefined {
		return this.currentCheckpoints;
	}

	/**
	 * Get the original checkpoints before any signatures.
	 */
	getOriginalCheckpoints(): string[] | undefined {
		return this.transaction.checkpoints;
	}

	/**
	 * Add a signature from a party.
	 *
	 * @param signature - The party's signature
	 * @param signedCheckpoints - The party's signed checkpoints (ARK-specific)
	 * @throws TransactionError if the role is not a required signer or has already signed
	 */
	addSignature(signature: PartySignature, signedCheckpoints?: string[]): void {
		const { role } = signature;

		// Validate role is required
		if (!this.transaction.unsigned.requiredSigners.includes(role)) {
			throw new TransactionError(
				`Role "${role}" is not a required signer`,
				"INVALID_SIGNER",
				{
					role,
					requiredSigners: this.transaction.unsigned.requiredSigners,
				},
			);
		}

		// Check for duplicate signature
		if (this.transaction.signatures.some((s) => s.role === role)) {
			throw new TransactionError(
				`Role "${role}" has already signed`,
				"DUPLICATE_SIGNATURE",
				{ role },
			);
		}

		// Add signature to list
		this.transaction.signatures.push(signature);

		// Merge the new signature into the accumulated PSBT
		this.currentPsbt = mergePsbt(signature.signedPsbt, this.currentPsbt);

		// Merge checkpoints if provided
		if (signedCheckpoints && this.currentCheckpoints) {
			this.currentCheckpoints = mergeCheckpointsPsbt(
				signedCheckpoints,
				this.currentCheckpoints,
			);
			this.transaction.signedCheckpoints = this.currentCheckpoints;
		}
	}

	/**
	 * Remove a signature from a party (for rollback scenarios).
	 *
	 * Note: This reconstructs the PSBT from scratch, which may be expensive.
	 * Use sparingly.
	 */
	removeSignature(role: string): void {
		const index = this.transaction.signatures.findIndex((s) => s.role === role);
		if (index === -1) {
			throw new TransactionError(
				`Role "${role}" has not signed`,
				"SIGNATURE_NOT_FOUND",
				{ role },
			);
		}

		// Remove the signature
		this.transaction.signatures.splice(index, 1);

		// Rebuild from scratch
		this.currentPsbt = this.transaction.unsigned.psbt;
		this.currentCheckpoints = this.transaction.checkpoints
			? [...this.transaction.checkpoints]
			: undefined;

		// Re-apply remaining signatures
		for (const sig of this.transaction.signatures) {
			this.currentPsbt = mergePsbt(sig.signedPsbt, this.currentPsbt);
		}
	}

	/**
	 * Get current signing status.
	 */
	getStatus(): SigningStatus {
		const completedSigners = this.transaction.signatures.map((s) => s.role);
		const pendingSigners = this.transaction.unsigned.requiredSigners.filter(
			(role) => !completedSigners.includes(role),
		);

		return {
			transaction: this.transaction,
			pendingSigners,
			completedSigners,
			isComplete: pendingSigners.length === 0,
		};
	}

	/**
	 * Check if the transaction is fully signed.
	 */
	isComplete(): boolean {
		return this.getStatus().isComplete;
	}

	/**
	 * Get the list of roles that have signed.
	 */
	getCompletedSigners(): string[] {
		return this.transaction.signatures.map((s) => s.role);
	}

	/**
	 * Get the list of roles that still need to sign.
	 */
	getPendingSigners(): string[] {
		return this.getStatus().pendingSigners;
	}

	/**
	 * Get the merged, fully signed transaction.
	 *
	 * Only call this when isComplete() returns true.
	 *
	 * @returns Object with signed PSBT and checkpoints
	 * @throws TransactionError if transaction is not fully signed
	 */
	getSignedTransaction(): { psbt: string; checkpoints?: string[] } {
		if (!this.isComplete()) {
			const status = this.getStatus();
			throw new TransactionError(
				`Transaction is not fully signed. Pending: ${status.pendingSigners.join(", ")}`,
				"INCOMPLETE_SIGNATURES",
				{ pendingSigners: status.pendingSigners },
			);
		}

		return {
			psbt: this.currentPsbt,
			checkpoints: this.currentCheckpoints,
		};
	}

	/**
	 * Get the current signature count for the transaction.
	 */
	getSignatureCount(): number {
		return countSignatures(this.currentPsbt);
	}

	/**
	 * Serialize the coordinator state for persistence.
	 *
	 * Use this to save the coordinator state and resume later.
	 */
	serialize(): string {
		return JSON.stringify({
			transaction: {
				unsigned: this.transaction.unsigned,
				signatures: this.transaction.signatures.map((s) => ({
					...s,
					pubkey: Array.from(s.pubkey), // Convert Uint8Array to array
				})),
				checkpoints: this.transaction.checkpoints,
				signedCheckpoints: this.transaction.signedCheckpoints,
			},
			currentPsbt: this.currentPsbt,
			currentCheckpoints: this.currentCheckpoints,
		});
	}

	/**
	 * Deserialize and restore coordinator state.
	 *
	 * @param data - Serialized coordinator state from serialize()
	 */
	static deserialize(data: string): SigningCoordinator {
		const parsed = JSON.parse(data);

		const coordinator = new SigningCoordinator(
			parsed.transaction.unsigned,
			parsed.transaction.checkpoints,
		);

		// Restore state
		coordinator.transaction.signatures = parsed.transaction.signatures.map(
			(s: { role: string; pubkey: number[]; signedPsbt: string }) => ({
				...s,
				pubkey: new Uint8Array(s.pubkey),
			}),
		);
		coordinator.transaction.signedCheckpoints =
			parsed.transaction.signedCheckpoints;
		coordinator.currentPsbt = parsed.currentPsbt;
		coordinator.currentCheckpoints = parsed.currentCheckpoints;

		return coordinator;
	}
}

/**
 * Create a signing coordinator from a clean transaction.
 *
 * This is a convenience function for creating a coordinator from
 * the transaction format returned by the server.
 */
export function createSigningCoordinator(
	cleanTx: {
		arkTx: string;
		checkpoints: string[];
		requiredSigners: string[];
		vtxo: { txid: string; vout: number; value: number };
	},
	spendingPathName: string,
): SigningCoordinator {
	const unsigned: UnsignedTransaction = {
		psbt: cleanTx.arkTx,
		spendingPath: {
			name: spendingPathName,
			description: "",
			type: "multisig",
			requiredRoles: cleanTx.requiredSigners,
			threshold: cleanTx.requiredSigners.length,
		},
		inputs: [cleanTx.vtxo],
		outputs: [], // Outputs are encoded in the PSBT
		requiredSigners: cleanTx.requiredSigners,
	};

	return new SigningCoordinator(unsigned, cleanTx.checkpoints);
}
