/**
 * Arkade SDK
 *
 * Modular SDK for building multi-party contracts on the ARK protocol.
 *
 * @example
 * ```typescript
 * import {
 *   ScriptBuilder,
 *   EscrowContract,
 *   SigningCoordinator,
 *   MemoryStorageAdapter,
 * } from "@arkade-escrow/sdk";
 *
 * // Create an escrow
 * const escrow = new EscrowContract({
 *   sender: { role: "sender", pubkey: senderKey },
 *   receiver: { role: "receiver", pubkey: receiverKey },
 *   serverPubkey: serverKey,
 *   unilateralDelay: { type: "blocks", value: 144 },
 *   amount: 100000,
 * });
 *
 * // Or build custom scripts
 * const treasury = new ScriptBuilder({
 *   parties: signers.map((k, i) => ({ role: `signer${i}`, pubkey: k })),
 *   spendingPaths: [
 *     { name: "spend", type: "multisig", requiredRoles: allRoles, threshold: 5 },
 *   ],
 * });
 * ```
 */

// Core - Script primitives and party system
export {
	// Types
	type XOnlyPubKey,
	type Party,
	type Timelock,
	type SpendingConditionType,
	type HashType,
	type HashCondition,
	type SpendingPath,
	type ScriptConfig,
	type BuiltScript,
	type NetworkType,
	type AddressInfo,
	// Classes
	ScriptBuilder,
	ScriptConfigError,
	// Utilities
	isValidXOnlyPubKey,
	validateParty,
	validateSpendingPath,
	validateScriptConfig,
	createMultisigPath,
	createTimelockedPath,
	createHashPreimagePath,
} from "./core/index.js";

// Contracts - State machines and lifecycle
export {
	// Types
	type StateDefinition,
	type StateTransition,
	type StateMachineConfig,
	type ContractMetadata,
	type ContractContext,
	type BaseContractConfig,
	type ActionResult,
	type FundingStatus,
	type FundingInfo,
	type ExecutionRequest,
	type ExecutionStatus,
	type Execution,
	// Classes
	ContractStateMachine,
	ContractError,
	// Utilities
	createState,
	createTransition,
} from "./contracts/index.js";

// Transactions - PSBT building and signing
export {
	// Types
	type VtxoRef,
	type TxOutput,
	type TxInput,
	type UnsignedTransaction,
	type PartySignature,
	type CleanTransaction,
	type SignedTransaction,
	type PartiallySignedTransaction,
	type SigningStatus,
	type SubmitResult,
	// Classes
	SigningCoordinator,
	TransactionError,
	// Utilities
	mergeTx,
	mergePsbt,
	mergeCheckpoints,
	mergeCheckpointsPsbt,
	countSignatures,
	hasRequiredSignatures,
	createSigningCoordinator,
} from "./transactions/index.js";

// Storage - Persistence adapters
export {
	// Types
	type StoredContract,
	type QueryOptions,
	type QueryResult,
	type StorageAdapter,
	type TransactionalStorageAdapter,
	type WatchableStorageAdapter,
	// Classes
	MemoryStorageAdapter,
	StorageError,
} from "./storage/index.js";

// Protocol - Blockchain adapters
export {
	// Types
	type ProtocolInfo,
	type VirtualCoin,
	type Balance,
	type TxStatus,
	type TxInfo,
	type WatchCallback,
	type ProtocolProvider,
	type ArkProtocolProvider,
	type ProtocolIndexer,
	// Classes
	ProtocolError,
} from "./protocol/index.js";

// Utils
export {
	bytesToHex,
	hexToBytes,
	bytesToBase64,
	base64ToBytes,
	stringToBytes,
	bytesToString,
	concatBytes,
	bytesEqual,
} from "./utils/index.js";

// Refresh - VTXO refresh coordination
export {
	// Types
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
	type RefreshFlow,
	type BatchJoiner,
	type ArkDelegateProvider,
	// Classes
	RefreshError,
	SimpleRefreshFlow,
	DelegatedRefreshFlow,
	DelegateExecutor,
	DelegateService,
	// Utilities
	createRefreshFlow,
	isDelegatedFlow,
	isSimpleFlow,
} from "./refresh/index.js";

// Modules - High-level implementations
// Escrow module
export {
	type EscrowRole,
	type EscrowState,
	type EscrowAction,
	type EscrowExecutionAction,
	type EscrowConfig,
	type EscrowData,
	type EscrowExecutionRequest,
	type EscrowDispute,
	type EscrowRefreshConfig,
	ACTION_TO_PATH,
	PATH_TO_SIGNERS,
	toSdkRefreshConfig,
	createEscrowSpendingPaths,
	createEscrowSpendingPathsWithRefresh,
	createEscrowParties,
	buildEscrowScriptConfig,
	createRefreshPath as createEscrowRefreshPath,
	getSignersForPath as getEscrowSignersForPath,
	isCollaborativePath,
	isTimelockedPath,
	getDestinationRole,
	ESCROW_STATE_MACHINE,
	canExecute as canExecuteEscrow,
	isFinalState as isEscrowFinalState,
	isActiveState,
	getAllowedActions as getEscrowAllowedActions,
	EscrowContract,
} from "./modules/escrow/index.js";

// Lending module
export {
	type LendingRole,
	type LendingState,
	type LendingAction,
	type LendingConfig,
	type LendingData,
	type Repayment,
	createLendingSpendingPaths,
	createLendingParties,
	buildLendingScriptConfig,
	getSignersForPath as getLendingSignersForPath,
	calculateRepaymentAmount,
	calculateRequiredCollateral,
	isCollateralSufficient,
	LENDING_STATE_MACHINE,
	canOperateOnCollateral,
	isRepaymentPhase,
	canLiquidate,
	isFinalState as isLendingFinalState,
	LendingContract,
} from "./modules/lending/index.js";
