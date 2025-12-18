/**
 * Refresh Flow Implementations
 *
 * Provides both SimpleRefreshFlow (single-user) and DelegatedRefreshFlow
 * (multi-party) for VTXO refresh operations.
 */

import { XOnlyPubKey, SpendingPath } from "../core/types.js";
import { VtxoRef } from "../transactions/types.js";
import {
	RefreshConfig,
	UnsignedIntent,
	SignedIntentPart,
	SignedIntent,
	UnsignedForfeit,
	PartialForfeitSig,
	DelegatePackage,
	SimpleRefreshRequest,
	RefreshResult,
	RefreshSigner,
	RefreshError,
} from "./types.js";

/**
 * Base interface for refresh flows.
 */
export interface RefreshFlow {
	/**
	 * Check if this contract supports refresh.
	 */
	isEnabled(): boolean;

	/**
	 * Get the refresh configuration.
	 */
	getConfig(): RefreshConfig | null;
}

/**
 * Simple refresh flow for single-user VTXOs.
 *
 * User joins batch directly - no delegation needed.
 * Used when the contract has only one non-operator party.
 *
 * @example
 * ```typescript
 * const flow = new SimpleRefreshFlow(config, scriptInfo);
 *
 * // Create refresh request
 * const request = flow.createRefreshRequest(vtxos);
 *
 * // Execute refresh (user signs and joins batch)
 * const result = await flow.executeRefresh(request, userSigner, provider);
 * ```
 */
export class SimpleRefreshFlow implements RefreshFlow {
	constructor(
		private readonly config: RefreshConfig | null,
		private readonly scriptInfo: {
			tapTree: Uint8Array;
			refreshPath: SpendingPath;
			refreshLeafScript: Uint8Array;
			destinationScript: string;
		},
	) {}

	isEnabled(): boolean {
		return this.config?.enabled ?? false;
	}

	getConfig(): RefreshConfig | null {
		return this.config;
	}

	/**
	 * Create a refresh request for the given VTXOs.
	 */
	createRefreshRequest(vtxos: VtxoRef[]): SimpleRefreshRequest {
		if (!this.isEnabled()) {
			throw new RefreshError(
				"Refresh is not enabled for this contract",
				"NOT_CONFIGURED",
			);
		}

		if (vtxos.length === 0) {
			throw new RefreshError("No VTXOs to refresh", "VTXO_NOT_FOUND");
		}

		return {
			vtxos,
			destinationScript: this.scriptInfo.destinationScript,
			tapTree: this.scriptInfo.tapTree,
			tapLeafScript: this.scriptInfo.refreshLeafScript,
		};
	}

	/**
	 * Execute refresh - user signs and joins batch directly.
	 *
	 * @param request - The refresh request
	 * @param signer - Signer for the user
	 * @param batchJoiner - Function to join the batch round
	 */
	async executeRefresh(
		request: SimpleRefreshRequest,
		signer: RefreshSigner,
		batchJoiner: BatchJoiner,
	): Promise<RefreshResult> {
		if (!this.isEnabled()) {
			throw new RefreshError(
				"Refresh is not enabled for this contract",
				"NOT_CONFIGURED",
			);
		}

		try {
			// Join batch and get new VTXOs
			const result = await batchJoiner.joinBatchDirect({
				vtxos: request.vtxos,
				destinationScript: request.destinationScript,
				tapTree: request.tapTree,
				tapLeafScript: request.tapLeafScript,
				signer,
			});

			return {
				success: true,
				newVtxos: result.newVtxos,
				txid: result.txid,
				newRoundId: result.roundId,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}

/**
 * Delegated refresh flow for multi-party contracts.
 *
 * All parties sign intent + ACP forfeit, then hand off to delegate
 * who joins the batch on their behalf.
 *
 * @example
 * ```typescript
 * const flow = new DelegatedRefreshFlow(config, scriptInfo, parties);
 *
 * // Step 1: Create intent
 * const intent = flow.createIntent(vtxos);
 *
 * // Step 2: All parties sign intent
 * const sigs = await Promise.all(
 *   signers.map(s => flow.signIntent(intent, s))
 * );
 * const signedIntent = flow.aggregateIntentSignatures(intent, sigs);
 *
 * // Step 3: Non-delegate parties sign forfeit with ACP
 * const forfeit = flow.createForfeit(signedIntent);
 * const forfeitSigs = await Promise.all(
 *   nonDelegateSigners.map(s => flow.signForfeitACP(forfeit, s))
 * );
 *
 * // Step 4: Package and hand to delegate
 * const pkg = flow.createDelegatePackage(signedIntent, forfeitSigs, delegatePubkey);
 *
 * // Step 5: Delegate executes (separate process)
 * ```
 */
export class DelegatedRefreshFlow implements RefreshFlow {
	constructor(
		private readonly config: RefreshConfig | null,
		private readonly scriptInfo: {
			tapTree: Uint8Array;
			refreshPath: SpendingPath;
			refreshLeafScript: Uint8Array;
			destinationScript: string;
		},
		private readonly parties: Map<string, XOnlyPubKey>,
	) {}

	isEnabled(): boolean {
		return this.config?.enabled ?? false;
	}

	getConfig(): RefreshConfig | null {
		return this.config;
	}

	/**
	 * Check if a role can act as delegate.
	 */
	canBeDelegate(role: string): boolean {
		if (!this.config?.enabled) return false;

		const source = this.config.delegateSource;
		if (source.type === "existing-party") {
			return source.roles.includes(role);
		}
		return false;
	}

	/**
	 * Check if a pubkey is the external delegate.
	 */
	isExternalDelegate(pubkey: XOnlyPubKey): boolean {
		if (!this.config?.enabled) return false;

		const source = this.config.delegateSource;
		if (source.type === "external") {
			return bytesEqual(source.pubkey, pubkey);
		}
		return false;
	}

	/**
	 * Get roles that can act as delegate.
	 */
	getDelegateRoles(): string[] {
		if (!this.config?.enabled) return [];

		const source = this.config.delegateSource;
		if (source.type === "existing-party") {
			return [...source.roles];
		}
		return [];
	}

	/**
	 * Step 1: Create unsigned intent for refresh.
	 */
	createIntent(vtxos: VtxoRef[]): UnsignedIntent {
		if (!this.isEnabled()) {
			throw new RefreshError(
				"Refresh is not enabled for this contract",
				"NOT_CONFIGURED",
			);
		}

		if (vtxos.length === 0) {
			throw new RefreshError("No VTXOs to refresh", "VTXO_NOT_FOUND");
		}

		// All non-operator parties must sign intent
		const requiredSigners = Array.from(this.parties.keys()).filter(
			(role) => role !== "operator" && role !== "server",
		);

		// Create intent message
		const intentMessage = createIntentMessage(
			vtxos,
			this.scriptInfo.destinationScript,
		);

		// Create unsigned intent PSBT
		// In a real implementation, this would build the actual PSBT
		const psbt = createIntentPsbt(
			vtxos,
			this.scriptInfo.destinationScript,
			this.scriptInfo.tapTree,
			this.scriptInfo.refreshLeafScript,
		);

		return {
			vtxos,
			psbt,
			requiredSigners,
			destinationScript: this.scriptInfo.destinationScript,
			intentMessage,
		};
	}

	/**
	 * Step 2a: Sign intent as a party.
	 */
	async signIntent(
		intent: UnsignedIntent,
		signer: RefreshSigner,
	): Promise<SignedIntentPart> {
		const role = signer.getRole();

		if (!intent.requiredSigners.includes(role)) {
			throw new RefreshError(
				`Role "${role}" is not a required signer for this intent`,
				"INVALID_SIGNATURE",
			);
		}

		const signedPsbt = await signer.sign(intent.psbt, "all");

		return {
			role,
			pubkey: signer.getPublicKey(),
			signedPsbt,
		};
	}

	/**
	 * Step 2b: Aggregate all intent signatures.
	 */
	aggregateIntentSignatures(
		intent: UnsignedIntent,
		signatures: SignedIntentPart[],
	): SignedIntent {
		// Verify all required signatures are present
		const signedRoles = new Set(signatures.map((s) => s.role));
		const missingRoles = intent.requiredSigners.filter(
			(r) => !signedRoles.has(r),
		);

		if (missingRoles.length > 0) {
			throw new RefreshError(
				`Missing intent signatures from: ${missingRoles.join(", ")}`,
				"MISSING_SIGNATURES",
				{ missingRoles },
			);
		}

		// Merge all signatures into single PSBT
		const signedPsbt = mergeSignedPsbts(
			intent.psbt,
			signatures.map((s) => s.signedPsbt),
		);

		return {
			unsigned: intent,
			signatures,
			signedPsbt,
		};
	}

	/**
	 * Step 3a: Create unsigned forfeit transaction.
	 *
	 * The forfeit will be signed with SIGHASH_ACP by non-delegate parties,
	 * allowing the delegate to add the connector input later.
	 */
	createForfeit(
		intent: SignedIntent,
		delegateRole: string,
	): UnsignedForfeit {
		// Validate delegate
		if (!this.canBeDelegate(delegateRole)) {
			throw new RefreshError(
				`Role "${delegateRole}" cannot act as delegate`,
				"INVALID_DELEGATE",
			);
		}

		// Everyone except delegate signs forfeit
		const requiredSigners = intent.unsigned.requiredSigners.filter(
			(r) => r !== delegateRole,
		);

		// Create unsigned forfeit PSBT
		// In a real implementation, this would build the actual forfeit PSBT
		const psbt = createForfeitPsbt(intent);

		return {
			intent,
			psbt,
			requiredSigners,
		};
	}

	/**
	 * Step 3b: Sign forfeit with SIGHASH_ACP.
	 *
	 * This allows the delegate to add the connector input later
	 * without invalidating the signature.
	 */
	async signForfeitACP(
		forfeit: UnsignedForfeit,
		signer: RefreshSigner,
	): Promise<PartialForfeitSig> {
		const role = signer.getRole();

		if (!forfeit.requiredSigners.includes(role)) {
			throw new RefreshError(
				`Role "${role}" is not a required signer for this forfeit`,
				"INVALID_SIGNATURE",
			);
		}

		// Sign with SIGHASH_ALL | ANYONECANPAY
		const signedPsbt = await signer.sign(forfeit.psbt, "acp");

		return {
			role,
			pubkey: signer.getPublicKey(),
			signedPsbt,
			sigHashMode: "acp",
		};
	}

	/**
	 * Step 4: Create delegate package.
	 *
	 * Package contains everything the delegate needs to execute refresh.
	 */
	createDelegatePackage(
		intent: SignedIntent,
		partialForfeits: PartialForfeitSig[],
		delegateRole: string,
		delegatePubkey: XOnlyPubKey,
		expiresInMs: number = 3600000, // Default 1 hour
	): DelegatePackage {
		// Validate delegate
		if (!this.canBeDelegate(delegateRole)) {
			throw new RefreshError(
				`Role "${delegateRole}" cannot act as delegate`,
				"INVALID_DELEGATE",
			);
		}

		// Verify all forfeits use ACP
		for (const sig of partialForfeits) {
			if (sig.sigHashMode !== "acp") {
				throw new RefreshError(
					`Forfeit signature from "${sig.role}" must use ACP sighash`,
					"INVALID_SIGHASH",
				);
			}
		}

		// Verify all required forfeits are present
		const expectedSigners = intent.unsigned.requiredSigners.filter(
			(r) => r !== delegateRole,
		);
		const signedRoles = new Set(partialForfeits.map((s) => s.role));
		const missingRoles = expectedSigners.filter((r) => !signedRoles.has(r));

		if (missingRoles.length > 0) {
			throw new RefreshError(
				`Missing forfeit signatures from: ${missingRoles.join(", ")}`,
				"MISSING_SIGNATURES",
				{ missingRoles },
			);
		}

		const now = Date.now();

		return {
			intent,
			partialForfeits,
			vtxos: intent.unsigned.vtxos,
			delegateRole,
			delegatePubkey,
			createdAt: now,
			expiresAt: now + expiresInMs,
		};
	}
}

/**
 * Interface for batch joining operations.
 *
 * Implemented by protocol providers to handle ARK-specific batch joining.
 */
export interface BatchJoiner {
	/**
	 * Join batch directly (single-user refresh).
	 */
	joinBatchDirect(params: {
		vtxos: VtxoRef[];
		destinationScript: string;
		tapTree: Uint8Array;
		tapLeafScript: Uint8Array;
		signer: RefreshSigner;
	}): Promise<{
		newVtxos: VtxoRef[];
		txid: string;
		roundId: string;
	}>;

	/**
	 * Join batch as delegate (multi-party refresh).
	 */
	joinBatchAsDelegate(params: {
		package: DelegatePackage;
		signer: RefreshSigner;
	}): Promise<{
		newVtxos: VtxoRef[];
		txid: string;
		roundId: string;
	}>;
}

// Helper functions (implementations would be in a separate utils file)

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function createIntentMessage(vtxos: VtxoRef[], destinationScript: string): string {
	// Create a canonical message for the intent
	const vtxoIds = vtxos.map((v) => `${v.txid}:${v.vout}`).join(",");
	return `refresh:${vtxoIds}:${destinationScript}:${Date.now()}`;
}

function createIntentPsbt(
	_vtxos: VtxoRef[],
	_destinationScript: string,
	_tapTree: Uint8Array,
	_tapLeafScript: Uint8Array,
): string {
	// Placeholder - actual implementation would build the PSBT
	// This would use @scure/btc-signer to construct the PSBT
	return "base64-encoded-intent-psbt";
}

function createForfeitPsbt(_intent: SignedIntent): string {
	// Placeholder - actual implementation would build the forfeit PSBT
	// The forfeit commits the VTXO to the ARK operator if the owner
	// doesn't complete the round
	return "base64-encoded-forfeit-psbt";
}

function mergeSignedPsbts(_basePsbt: string, _signedPsbts: string[]): string {
	// Placeholder - actual implementation would merge signatures
	// This would use @scure/btc-signer to merge the PSBTs
	return "base64-encoded-merged-psbt";
}

/**
 * Factory function to create appropriate refresh flow based on contract structure.
 */
export function createRefreshFlow(
	config: RefreshConfig | null,
	scriptInfo: {
		tapTree: Uint8Array;
		refreshPath: SpendingPath;
		refreshLeafScript: Uint8Array;
		destinationScript: string;
	},
	parties: Map<string, XOnlyPubKey>,
): SimpleRefreshFlow | DelegatedRefreshFlow {
	// Count non-operator parties
	const ownerCount = Array.from(parties.keys()).filter(
		(role) => role !== "operator" && role !== "server",
	).length;

	if (ownerCount <= 1) {
		return new SimpleRefreshFlow(config, scriptInfo);
	} else {
		return new DelegatedRefreshFlow(config, scriptInfo, parties);
	}
}

/**
 * Type guard to check if flow is delegated.
 */
export function isDelegatedFlow(
	flow: RefreshFlow,
): flow is DelegatedRefreshFlow {
	return flow instanceof DelegatedRefreshFlow;
}

/**
 * Type guard to check if flow is simple.
 */
export function isSimpleFlow(flow: RefreshFlow): flow is SimpleRefreshFlow {
	return flow instanceof SimpleRefreshFlow;
}
