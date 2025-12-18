/**
 * Storage module - Pluggable persistence adapters
 *
 * This module defines storage interfaces and provides reference implementations.
 * Developers bring their own persistence layer by implementing StorageAdapter.
 */

// Types
export type {
	StoredContract,
	QueryOptions,
	QueryResult,
	StorageAdapter,
	TransactionalStorageAdapter,
	WatchableStorageAdapter,
} from "./types.js";

export { StorageError } from "./types.js";

// Reference implementations
export { MemoryStorageAdapter } from "./memory-adapter.js";
