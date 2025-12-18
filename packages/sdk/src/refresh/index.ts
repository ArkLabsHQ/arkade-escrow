/**
 * Refresh Module
 *
 * VTXO refresh coordination for ARK protocol.
 * Supports both single-user and multi-party delegation models.
 *
 * @example
 * ```typescript
 * import {
 *   SimpleRefreshFlow,
 *   DelegatedRefreshFlow,
 *   DelegateExecutor,
 *   createRefreshFlow,
 * } from "@arkade-escrow/sdk/refresh";
 *
 * // Single-user: direct batch joining
 * const simpleFlow = new SimpleRefreshFlow(config, scriptInfo);
 * const request = simpleFlow.createRefreshRequest(vtxos);
 * const result = await simpleFlow.executeRefresh(request, signer, batchJoiner);
 *
 * // Multi-party: delegated refresh
 * const delegatedFlow = new DelegatedRefreshFlow(config, scriptInfo, parties);
 * const intent = delegatedFlow.createIntent(vtxos);
 * // ... collect signatures, create package, hand to delegate
 * ```
 */

// Types
export {
	type SigHashMode,
	type DelegateSource,
	type RefreshConfig,
	type RoundInfo,
	type UnsignedIntent,
	type SignedIntentPart,
	type SignedIntent,
	type UnsignedForfeit,
	type PartialForfeitSig,
	type DelegatePackage,
	type RefreshResult,
	type SimpleRefreshRequest,
	type RefreshStatus,
	type RefreshOperation,
	type RefreshEventCallbacks,
	type RefreshSigner,
	type RefreshErrorCode,
	RefreshError,
} from "./types.js";

// Refresh flows
export {
	type RefreshFlow,
	type BatchJoiner,
	SimpleRefreshFlow,
	DelegatedRefreshFlow,
	createRefreshFlow,
	isDelegatedFlow,
	isSimpleFlow,
} from "./refresh-flow.js";

// Delegate execution
export {
	type ArkDelegateProvider,
	DelegateExecutor,
	DelegateService,
} from "./delegate-executor.js";
