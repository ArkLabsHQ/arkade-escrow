/**
 * Delegate Executor
 *
 * Handles the delegate-side execution of refresh operations.
 * The delegate receives a package from other parties and joins
 * the batch round on their behalf.
 */

import { XOnlyPubKey } from "../core/types.js";
import { VtxoRef } from "../transactions/types.js";
import {
	DelegatePackage,
	RefreshResult,
	RefreshSigner,
	RefreshError,
	RefreshOperation,
} from "./types.js";

/**
 * ARK protocol interface for delegate operations.
 *
 * This interface abstracts the ARK-specific operations needed
 * for delegate refresh execution.
 */
export interface ArkDelegateProvider {
	/**
	 * Register the intent with the ARK operator.
	 *
	 * @param signedIntent - Base64 encoded signed intent
	 * @param intentMessage - The intent message
	 * @returns Intent ID for tracking
	 */
	registerIntent(
		signedIntent: string,
		intentMessage: string,
	): Promise<string>;

	/**
	 * Join the batch session as delegate.
	 *
	 * The delegate handler coordinates:
	 * 1. Co-signing the tree
	 * 2. Adding connector to forfeit
	 * 3. Completing forfeit signature
	 * 4. Submitting transactions
	 *
	 * @param intentId - Previously registered intent ID
	 * @param partialForfeits - ACP-signed forfeits from other parties
	 * @param signer - Delegate's signer for tree + forfeit
	 * @returns Batch result with new VTXOs
	 */
	joinBatchSession(
		intentId: string,
		partialForfeits: string[],
		signer: RefreshSigner,
	): Promise<{
		txid: string;
		newVtxos: VtxoRef[];
		roundId: string;
	}>;

	/**
	 * Get current block height (for expiry checking).
	 */
	getBlockHeight(): Promise<number>;

	/**
	 * Get round info for VTXOs.
	 */
	getRoundInfo(vtxos: VtxoRef[]): Promise<{
		roundId: string;
		expiresAtBlock: number;
		blocksRemaining: number;
	}>;
}

/**
 * Delegate executor for multi-party refresh operations.
 *
 * The delegate receives a package containing:
 * - Signed intent from all parties
 * - ACP-signed forfeits from non-delegate parties
 *
 * The delegate then:
 * 1. Registers the intent with the ARK operator
 * 2. Joins the batch session
 * 3. Co-signs the commitment tree
 * 4. Adds connector to forfeit and completes signature
 * 5. Returns new VTXOs to all parties
 *
 * @example
 * ```typescript
 * const executor = new DelegateExecutor(provider, delegatePubkey);
 *
 * // Validate and execute package
 * const result = await executor.executeRefresh(package, delegateSigner);
 *
 * if (result.success) {
 *   console.log("New VTXOs:", result.newVtxos);
 * }
 * ```
 */
export class DelegateExecutor {
	private pendingOperations: Map<string, RefreshOperation> = new Map();

	constructor(
		private readonly provider: ArkDelegateProvider,
		private readonly delegatePubkey: XOnlyPubKey,
	) {}

	/**
	 * Validate a delegate package before execution.
	 */
	validatePackage(pkg: DelegatePackage): void {
		// Check package hasn't expired
		if (Date.now() > pkg.expiresAt) {
			throw new RefreshError(
				"Delegate package has expired",
				"PACKAGE_EXPIRED",
				{ expiresAt: pkg.expiresAt, now: Date.now() },
			);
		}

		// Check we're the designated delegate
		if (!bytesEqual(pkg.delegatePubkey, this.delegatePubkey)) {
			throw new RefreshError(
				"Package is not for this delegate",
				"INVALID_DELEGATE",
			);
		}

		// Check VTXOs exist
		if (pkg.vtxos.length === 0) {
			throw new RefreshError("No VTXOs in package", "VTXO_NOT_FOUND");
		}

		// Check all forfeit signatures are ACP
		for (const sig of pkg.partialForfeits) {
			if (sig.sigHashMode !== "acp") {
				throw new RefreshError(
					`Forfeit from "${sig.role}" has invalid sighash mode: ${sig.sigHashMode}`,
					"INVALID_SIGHASH",
				);
			}
		}
	}

	/**
	 * Execute the refresh as delegate.
	 *
	 * This is the main entry point for delegate execution.
	 */
	async executeRefresh(
		pkg: DelegatePackage,
		signer: RefreshSigner,
	): Promise<RefreshResult> {
		// Validate package
		this.validatePackage(pkg);

		// Create operation tracking
		const operationId = generateOperationId();
		const operation: RefreshOperation = {
			id: operationId,
			status: "pending",
			package: pkg,
			timestamps: {
				created: Date.now(),
			},
		};
		this.pendingOperations.set(operationId, operation);

		try {
			// Step 1: Register intent
			const intentId = await this.registerIntent(pkg);
			operation.intentId = intentId;
			operation.status = "registered";
			operation.timestamps.registered = Date.now();

			// Step 2: Join batch session
			operation.status = "in-batch";
			operation.timestamps.inBatch = Date.now();

			const result = await this.joinBatch(pkg, intentId, signer);

			// Step 3: Success
			operation.status = "completed";
			operation.timestamps.completed = Date.now();
			operation.result = {
				success: true,
				newVtxos: result.newVtxos,
				txid: result.txid,
				newRoundId: result.roundId,
			};

			return operation.result;
		} catch (error) {
			operation.status = "failed";
			operation.result = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
			return operation.result;
		} finally {
			// Clean up after some time
			setTimeout(() => {
				this.pendingOperations.delete(operationId);
			}, 3600000); // 1 hour
		}
	}

	/**
	 * Register the intent with the ARK operator.
	 */
	private async registerIntent(pkg: DelegatePackage): Promise<string> {
		try {
			return await this.provider.registerIntent(
				pkg.intent.signedPsbt,
				pkg.intent.unsigned.intentMessage,
			);
		} catch (error) {
			throw new RefreshError(
				`Failed to register intent: ${error instanceof Error ? error.message : String(error)}`,
				"INTENT_FAILED",
				{ error },
			);
		}
	}

	/**
	 * Join the batch session as delegate.
	 */
	private async joinBatch(
		pkg: DelegatePackage,
		intentId: string,
		signer: RefreshSigner,
	): Promise<{
		txid: string;
		newVtxos: VtxoRef[];
		roundId: string;
	}> {
		try {
			const partialForfeits = pkg.partialForfeits.map((f) => f.signedPsbt);

			return await this.provider.joinBatchSession(
				intentId,
				partialForfeits,
				signer,
			);
		} catch (error) {
			throw new RefreshError(
				`Failed to join batch: ${error instanceof Error ? error.message : String(error)}`,
				"BATCH_FAILED",
				{ error },
			);
		}
	}

	/**
	 * Get status of a pending operation.
	 */
	getOperationStatus(operationId: string): RefreshOperation | undefined {
		return this.pendingOperations.get(operationId);
	}

	/**
	 * Get all pending operations.
	 */
	getPendingOperations(): RefreshOperation[] {
		return Array.from(this.pendingOperations.values()).filter(
			(op) => op.status !== "completed" && op.status !== "failed",
		);
	}

	/**
	 * Check if VTXOs need refresh and execute if needed.
	 *
	 * This is a convenience method for automated refresh.
	 */
	async checkAndRefreshIfNeeded(
		pkg: DelegatePackage,
		signer: RefreshSigner,
		thresholdBlocks: number = 10,
	): Promise<RefreshResult | null> {
		// Check round expiry
		const roundInfo = await this.provider.getRoundInfo(pkg.vtxos);

		if (roundInfo.blocksRemaining > thresholdBlocks) {
			// No refresh needed yet
			return null;
		}

		// Execute refresh
		return this.executeRefresh(pkg, signer);
	}
}

/**
 * Delegate service that can accept packages from multiple contracts.
 *
 * This is a higher-level abstraction for running a delegate service
 * that handles refresh for multiple parties.
 *
 * @example
 * ```typescript
 * const service = new DelegateService(provider, delegateKey, delegateSigner);
 *
 * // Accept packages via API
 * app.post("/refresh", async (req, res) => {
 *   const pkg = req.body as DelegatePackage;
 *   const id = await service.submitPackage(pkg);
 *   res.json({ operationId: id });
 * });
 *
 * // Start background processing
 * service.startAutoRefresh({ checkIntervalMs: 60000 });
 * ```
 */
export class DelegateService {
	private readonly executor: DelegateExecutor;
	private packageQueue: Map<string, DelegatePackage> = new Map();
	private autoRefreshInterval: ReturnType<typeof setInterval> | null = null;

	constructor(
		provider: ArkDelegateProvider,
		delegatePubkey: XOnlyPubKey,
		private readonly signer: RefreshSigner,
	) {
		this.executor = new DelegateExecutor(provider, delegatePubkey);
	}

	/**
	 * Submit a package for refresh.
	 *
	 * @returns Operation ID for tracking
	 */
	async submitPackage(pkg: DelegatePackage): Promise<string> {
		// Validate package
		this.executor.validatePackage(pkg);

		// Generate ID and queue
		const id = generateOperationId();
		this.packageQueue.set(id, pkg);

		return id;
	}

	/**
	 * Execute a queued package immediately.
	 */
	async executePackage(operationId: string): Promise<RefreshResult> {
		const pkg = this.packageQueue.get(operationId);
		if (!pkg) {
			throw new RefreshError(
				`Operation ${operationId} not found`,
				"VTXO_NOT_FOUND",
			);
		}

		const result = await this.executor.executeRefresh(pkg, this.signer);

		if (result.success) {
			this.packageQueue.delete(operationId);
		}

		return result;
	}

	/**
	 * Start automatic refresh checking.
	 *
	 * Periodically checks queued packages and executes refresh
	 * when VTXOs approach expiry.
	 */
	startAutoRefresh(config: {
		checkIntervalMs: number;
		thresholdBlocks: number;
	}): void {
		if (this.autoRefreshInterval) {
			clearInterval(this.autoRefreshInterval);
		}

		this.autoRefreshInterval = setInterval(async () => {
			await this.checkAndRefreshAll(config.thresholdBlocks);
		}, config.checkIntervalMs);
	}

	/**
	 * Stop automatic refresh checking.
	 */
	stopAutoRefresh(): void {
		if (this.autoRefreshInterval) {
			clearInterval(this.autoRefreshInterval);
			this.autoRefreshInterval = null;
		}
	}

	/**
	 * Check all queued packages and refresh if needed.
	 */
	private async checkAndRefreshAll(thresholdBlocks: number): Promise<void> {
		for (const [id, pkg] of this.packageQueue.entries()) {
			try {
				const result = await this.executor.checkAndRefreshIfNeeded(
					pkg,
					this.signer,
					thresholdBlocks,
				);

				if (result?.success) {
					this.packageQueue.delete(id);
				}
			} catch (error) {
				console.error(`Failed to check/refresh ${id}:`, error);
			}
		}
	}

	/**
	 * Get the underlying executor for direct access.
	 */
	getExecutor(): DelegateExecutor {
		return this.executor;
	}

	/**
	 * Get number of queued packages.
	 */
	getQueueSize(): number {
		return this.packageQueue.size;
	}
}

// Helper functions

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function generateOperationId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `refresh-${timestamp}-${random}`;
}
