/**
 * In-Memory Storage Adapter
 *
 * A simple in-memory storage adapter for testing and development.
 * Data is lost when the process exits.
 */

import {
	StorageAdapter,
	StoredContract,
	QueryOptions,
	QueryResult,
} from "./types.js";

/**
 * In-memory storage adapter.
 *
 * Useful for:
 * - Unit testing
 * - Development and prototyping
 * - Short-lived applications
 * - Caching layer
 *
 * @example
 * ```typescript
 * const storage = new MemoryStorageAdapter();
 *
 * await storage.save("contract-1", {
 *   metadata: { id: "contract-1", ... },
 *   state: "draft",
 *   data: { amount: 100000 },
 * });
 *
 * const contract = await storage.load("contract-1");
 * ```
 */
export class MemoryStorageAdapter implements StorageAdapter {
	private contracts: Map<string, StoredContract> = new Map();

	/**
	 * Save a contract to memory.
	 */
	async save(id: string, contract: StoredContract): Promise<void> {
		// Deep clone to prevent external mutations
		this.contracts.set(id, JSON.parse(JSON.stringify(contract)));
	}

	/**
	 * Load a contract from memory.
	 */
	async load(id: string): Promise<StoredContract | null> {
		const contract = this.contracts.get(id);
		if (!contract) return null;
		// Return a copy to prevent external mutations
		return JSON.parse(JSON.stringify(contract));
	}

	/**
	 * Delete a contract from memory.
	 */
	async delete(id: string): Promise<void> {
		this.contracts.delete(id);
	}

	/**
	 * Check if a contract exists.
	 */
	async exists(id: string): Promise<boolean> {
		return this.contracts.has(id);
	}

	/**
	 * List contracts matching query options.
	 */
	async list(options?: QueryOptions): Promise<StoredContract[]> {
		const result = await this.query(options);
		return result.items;
	}

	/**
	 * Query contracts with pagination.
	 */
	async query(options?: QueryOptions): Promise<QueryResult<StoredContract>> {
		let contracts = Array.from(this.contracts.values());

		// Apply filters
		if (options?.state) {
			const states = Array.isArray(options.state)
				? options.state
				: [options.state];
			contracts = contracts.filter((c) => states.includes(c.state));
		}

		if (options?.contractType) {
			contracts = contracts.filter(
				(c) => c.metadata.contractType === options.contractType,
			);
		}

		if (options?.createdAfter) {
			contracts = contracts.filter(
				(c) => c.metadata.createdAt > options.createdAfter!,
			);
		}

		if (options?.createdBefore) {
			contracts = contracts.filter(
				(c) => c.metadata.createdAt < options.createdBefore!,
			);
		}

		if (options?.updatedAfter) {
			contracts = contracts.filter(
				(c) => c.metadata.updatedAt > options.updatedAfter!,
			);
		}

		// Get total before pagination
		const total = contracts.length;

		// Sort
		const sortBy = options?.sortBy ?? "createdAt";
		const sortOrder = options?.sortOrder ?? "desc";
		contracts.sort((a, b) => {
			let aVal: string | number;
			let bVal: string | number;

			switch (sortBy) {
				case "id":
					aVal = a.metadata.id;
					bVal = b.metadata.id;
					break;
				case "updatedAt":
					aVal = a.metadata.updatedAt;
					bVal = b.metadata.updatedAt;
					break;
				case "createdAt":
				default:
					aVal = a.metadata.createdAt;
					bVal = b.metadata.createdAt;
					break;
			}

			if (sortOrder === "asc") {
				return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
			}
			return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
		});

		// Apply pagination
		const offset = options?.offset ?? 0;
		const limit = options?.limit ?? contracts.length;
		contracts = contracts.slice(offset, offset + limit);

		// Return copies
		const items = contracts.map((c) => JSON.parse(JSON.stringify(c)));
		const hasMore = offset + items.length < total;

		return {
			items,
			total,
			hasMore,
		};
	}

	/**
	 * Count contracts matching query options.
	 */
	async count(options?: QueryOptions): Promise<number> {
		const result = await this.query({ ...options, limit: 0 });
		return result.total;
	}

	/**
	 * Clear all contracts from memory.
	 */
	clear(): void {
		this.contracts.clear();
	}

	/**
	 * Get the number of contracts stored.
	 */
	size(): number {
		return this.contracts.size;
	}

	/**
	 * Get all contract IDs.
	 */
	keys(): string[] {
		return Array.from(this.contracts.keys());
	}
}
