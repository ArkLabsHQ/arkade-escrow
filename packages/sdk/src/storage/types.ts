/**
 * Storage Adapter Types
 *
 * Defines interfaces for pluggable storage backends. Developers bring
 * their own persistence layer (SQLite, IndexedDB, Postgres, etc.)
 * by implementing these interfaces.
 */

import { ContractMetadata } from "../contracts/types.js";

/**
 * Contract data structure for storage.
 */
export interface StoredContract<TData = unknown> {
	/** Contract metadata */
	metadata: ContractMetadata;
	/** Current state of the contract */
	state: string;
	/** Contract-specific data */
	data: TData;
	/** Script configuration (serialized) */
	scriptConfig?: unknown;
}

/**
 * Query options for listing contracts.
 */
export interface QueryOptions {
	/** Filter by state(s) */
	state?: string | string[];
	/** Filter by contract type */
	contractType?: string;
	/** Filter contracts created after this timestamp */
	createdAfter?: number;
	/** Filter contracts created before this timestamp */
	createdBefore?: number;
	/** Filter contracts updated after this timestamp */
	updatedAfter?: number;
	/** Maximum number of results */
	limit?: number;
	/** Number of results to skip */
	offset?: number;
	/** Sort field */
	sortBy?: "createdAt" | "updatedAt" | "id";
	/** Sort direction */
	sortOrder?: "asc" | "desc";
	/** Custom filters (adapter-specific) */
	filters?: Record<string, unknown>;
}

/**
 * Query result with pagination info.
 */
export interface QueryResult<T> {
	/** The items matching the query */
	items: T[];
	/** Total count of matching items (before pagination) */
	total: number;
	/** Whether there are more items */
	hasMore: boolean;
	/** Cursor for next page (if supported) */
	cursor?: string;
}

/**
 * Storage adapter interface.
 *
 * Implement this interface to provide persistence for contracts.
 * The SDK doesn't care about the underlying storage mechanism -
 * you can use SQLite, PostgreSQL, IndexedDB, in-memory, etc.
 *
 * @example
 * ```typescript
 * class PostgresStorageAdapter implements StorageAdapter {
 *   constructor(private pool: Pool) {}
 *
 *   async save(id: string, contract: StoredContract): Promise<void> {
 *     await this.pool.query(
 *       'INSERT INTO contracts (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
 *       [id, JSON.stringify(contract)]
 *     );
 *   }
 *
 *   // ... other methods
 * }
 * ```
 */
export interface StorageAdapter {
	/**
	 * Save a contract to storage.
	 *
	 * Should create or update the contract. If a contract with the
	 * same ID already exists, it should be replaced.
	 */
	save(id: string, contract: StoredContract): Promise<void>;

	/**
	 * Load a contract from storage.
	 *
	 * @returns The contract if found, null otherwise
	 */
	load(id: string): Promise<StoredContract | null>;

	/**
	 * Delete a contract from storage.
	 *
	 * Should succeed even if the contract doesn't exist.
	 */
	delete(id: string): Promise<void>;

	/**
	 * Check if a contract exists.
	 */
	exists(id: string): Promise<boolean>;

	/**
	 * List contracts matching query options.
	 */
	list(options?: QueryOptions): Promise<StoredContract[]>;

	/**
	 * List contracts with pagination info.
	 */
	query(options?: QueryOptions): Promise<QueryResult<StoredContract>>;

	/**
	 * Count contracts matching query options.
	 */
	count(options?: QueryOptions): Promise<number>;
}

/**
 * Extended storage adapter with transaction support.
 *
 * Implement this if your storage backend supports transactions.
 */
export interface TransactionalStorageAdapter extends StorageAdapter {
	/**
	 * Begin a transaction.
	 */
	beginTransaction(): Promise<void>;

	/**
	 * Commit the current transaction.
	 */
	commit(): Promise<void>;

	/**
	 * Rollback the current transaction.
	 */
	rollback(): Promise<void>;

	/**
	 * Execute a function within a transaction.
	 *
	 * If the function throws, the transaction is rolled back.
	 * Otherwise, it's committed.
	 */
	withTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Storage adapter with watch/subscribe support.
 *
 * Implement this for real-time updates.
 */
export interface WatchableStorageAdapter extends StorageAdapter {
	/**
	 * Watch for changes to a specific contract.
	 *
	 * @returns Unsubscribe function
	 */
	watch(
		id: string,
		callback: (contract: StoredContract | null) => void,
	): () => void;

	/**
	 * Watch for changes matching a query.
	 *
	 * @returns Unsubscribe function
	 */
	watchQuery(
		options: QueryOptions,
		callback: (contracts: StoredContract[]) => void,
	): () => void;
}

/**
 * Error thrown by storage operations.
 */
export class StorageError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "StorageError";
	}
}
