/**
 * TypeORM Storage Adapter
 *
 * Implements the SDK's StorageAdapter interface using TypeORM and the existing
 * EscrowContract entity. This bridges the SDK's generic storage abstraction
 * with the application's existing database infrastructure.
 */

import { Repository, Brackets } from "typeorm";
import {
	StorageAdapter,
	StoredContract,
	QueryOptions,
	QueryResult,
	StorageError,
} from "@arkade-escrow/sdk";
import { EscrowContract, ContractStatus } from "./escrow-contract.entity";
import { mapStatusToSdkState, mapSdkStateToStatus } from "./sdk-integration";

/**
 * Simplified virtual coin reference (subset of VirtualCoin fields we use).
 */
export interface VtxoReference {
	txid: string;
	vout: number;
	value: number;
}

/**
 * Escrow-specific data stored in the SDK's StoredContract.data field.
 */
export interface EscrowContractData {
	senderPubkey: string;
	receiverPubkey: string;
	receiverAddress?: string;
	amount: number;
	arkAddress?: string;
	virtualCoins?: VtxoReference[];
	createdBy: "sender" | "receiver";
	cancelationReason?: string;
	requestId: string;
}

/**
 * TypeORM-based storage adapter for escrow contracts.
 *
 * This adapter translates between:
 * - SDK's generic StoredContract format
 * - Application's EscrowContract TypeORM entity
 *
 * @example
 * ```typescript
 * const adapter = new TypeOrmStorageAdapter(contractRepository);
 *
 * // Save using SDK format
 * await adapter.save("contract-1", {
 *   metadata: { id: "contract-1", ... },
 *   state: "funded",
 *   data: { senderPubkey: "...", ... },
 * });
 *
 * // Load returns SDK format
 * const contract = await adapter.load("contract-1");
 * ```
 */
export class TypeOrmStorageAdapter
	implements StorageAdapter
{
	constructor(
		private readonly repository: Repository<EscrowContract>,
	) {}

	/**
	 * Convert SDK StoredContract to TypeORM entity update fields.
	 *
	 * Note: virtualCoins are NOT stored via this adapter. They are fetched
	 * directly from the ARK protocol and updated via direct repository calls.
	 */
	private toEntityUpdate(
		contract: StoredContract<EscrowContractData>,
	): Partial<EscrowContract> {
		const status = mapSdkStateToStatus(contract.state as Parameters<typeof mapSdkStateToStatus>[0]);

		return {
			externalId: contract.metadata.id,
			status,
			senderPubkey: contract.data.senderPubkey,
			receiverPubkey: contract.data.receiverPubkey,
			receiverAddress: contract.data.receiverAddress,
			amount: contract.data.amount,
			arkAddress: contract.data.arkAddress,
			// virtualCoins are not stored here - they come from ARK protocol
			createdBy: contract.data.createdBy,
			cancelationReason: contract.data.cancelationReason,
		};
	}

	/**
	 * Convert TypeORM entity to SDK StoredContract.
	 */
	private toStoredContract(
		entity: EscrowContract,
	): StoredContract<EscrowContractData> {
		const sdkState = mapStatusToSdkState(entity.status);

		return {
			metadata: {
				id: entity.externalId,
				createdAt: entity.createdAt.getTime(),
				updatedAt: entity.updatedAt.getTime(),
				version: 1, // TypeORM doesn't track versions by default
				contractType: "escrow",
			},
			state: sdkState,
			data: {
				senderPubkey: entity.senderPubkey,
				receiverPubkey: entity.receiverPubkey,
				receiverAddress: entity.receiverAddress,
				amount: entity.amount,
				arkAddress: entity.arkAddress,
				virtualCoins: entity.virtualCoins,
				createdBy: entity.createdBy,
				cancelationReason: entity.cancelationReason,
				requestId: entity.request?.externalId ?? "",
			},
		};
	}

	/**
	 * Map SDK state filter to entity status values.
	 */
	private mapStateToStatuses(state: string | string[]): ContractStatus[] {
		const states = Array.isArray(state) ? state : [state];
		const statusMap: Record<string, ContractStatus[]> = {
			draft: ["draft"],
			created: ["created"],
			funded: ["funded"],
			"pending-execution": ["pending-execution"],
			completed: ["completed"],
			canceled: [
				"canceled-by-creator",
				"rejected-by-counterparty",
				"rescinded-by-creator",
				"rescinded-by-counterparty",
			],
			voided: ["voided-by-arbiter"],
			disputed: ["under-arbitration"],
		};

		return states.flatMap((s) => statusMap[s] ?? []);
	}

	/**
	 * Save a contract to storage.
	 */
	async save(
		id: string,
		contract: StoredContract<EscrowContractData>,
	): Promise<void> {
		try {
			const existing = await this.repository.findOne({
				where: { externalId: id },
			});

			const updateFields = this.toEntityUpdate(contract);

			if (existing) {
				await this.repository.update({ externalId: id }, updateFields);
			} else {
				const entity = this.repository.create({
					...updateFields,
					externalId: id,
					request: { externalId: contract.data.requestId } as { externalId: string },
				});
				await this.repository.save(entity);
			}
		} catch (error) {
			throw new StorageError(
				`Failed to save contract ${id}`,
				"SAVE_ERROR",
				{ error },
			);
		}
	}

	/**
	 * Load a contract from storage.
	 */
	async load(id: string): Promise<StoredContract<EscrowContractData> | null> {
		try {
			const entity = await this.repository.findOne({
				where: { externalId: id },
			});

			if (!entity) return null;

			return this.toStoredContract(entity);
		} catch (error) {
			throw new StorageError(
				`Failed to load contract ${id}`,
				"LOAD_ERROR",
				{ error },
			);
		}
	}

	/**
	 * Delete a contract from storage.
	 */
	async delete(id: string): Promise<void> {
		try {
			await this.repository.delete({ externalId: id });
		} catch (error) {
			throw new StorageError(
				`Failed to delete contract ${id}`,
				"DELETE_ERROR",
				{ error },
			);
		}
	}

	/**
	 * Check if a contract exists.
	 */
	async exists(id: string): Promise<boolean> {
		try {
			const count = await this.repository.count({
				where: { externalId: id },
			});
			return count > 0;
		} catch (error) {
			throw new StorageError(
				`Failed to check existence of contract ${id}`,
				"EXISTS_ERROR",
				{ error },
			);
		}
	}

	/**
	 * List contracts matching query options.
	 */
	async list(
		options?: QueryOptions,
	): Promise<StoredContract<EscrowContractData>[]> {
		const result = await this.query(options);
		return result.items;
	}

	/**
	 * Query contracts with pagination.
	 */
	async query(
		options?: QueryOptions,
	): Promise<QueryResult<StoredContract<EscrowContractData>>> {
		try {
			const qb = this.repository.createQueryBuilder("c");
			qb.leftJoinAndSelect("c.request", "request");

			// Apply state filter
			if (options?.state) {
				const statuses = this.mapStateToStatuses(options.state);
				if (statuses.length > 0) {
					qb.andWhere("c.status IN (:...statuses)", { statuses });
				}
			}

			// Apply date filters
			if (options?.createdAfter) {
				qb.andWhere("c.createdAt > :createdAfter", {
					createdAfter: new Date(options.createdAfter),
				});
			}

			if (options?.createdBefore) {
				qb.andWhere("c.createdAt < :createdBefore", {
					createdBefore: new Date(options.createdBefore),
				});
			}

			if (options?.updatedAfter) {
				qb.andWhere("c.updatedAt > :updatedAfter", {
					updatedAfter: new Date(options.updatedAfter),
				});
			}

			// Apply custom filters (e.g., filter by pubkey)
			if (options?.filters) {
				if (options.filters.senderPubkey) {
					qb.andWhere("c.senderPubkey = :senderPubkey", {
						senderPubkey: options.filters.senderPubkey,
					});
				}
				if (options.filters.receiverPubkey) {
					qb.andWhere("c.receiverPubkey = :receiverPubkey", {
						receiverPubkey: options.filters.receiverPubkey,
					});
				}
				if (options.filters.partyPubkey) {
					qb.andWhere(
						new Brackets((w) => {
							w.where("c.senderPubkey = :partyPubkey", {
								partyPubkey: options.filters!.partyPubkey,
							}).orWhere("c.receiverPubkey = :partyPubkey", {
								partyPubkey: options.filters!.partyPubkey,
							});
						}),
					);
				}
			}

			// Get total count before pagination
			const total = await qb.getCount();

			// Apply sorting
			const sortBy = options?.sortBy ?? "createdAt";
			const sortOrder = options?.sortOrder === "asc" ? "ASC" : "DESC";
			qb.orderBy(`c.${sortBy}`, sortOrder);

			// Apply pagination
			if (options?.offset) {
				qb.skip(options.offset);
			}
			if (options?.limit) {
				qb.take(options.limit);
			}

			const entities = await qb.getMany();
			const items = entities.map((e) => this.toStoredContract(e));
			const hasMore = (options?.offset ?? 0) + items.length < total;

			return { items, total, hasMore };
		} catch (error) {
			throw new StorageError(
				"Failed to query contracts",
				"QUERY_ERROR",
				{ error },
			);
		}
	}

	/**
	 * Count contracts matching query options.
	 */
	async count(options?: QueryOptions): Promise<number> {
		const result = await this.query({ ...options, limit: 0 });
		return result.total;
	}

	/**
	 * Get the underlying TypeORM repository for advanced operations.
	 *
	 * Use this when you need to perform operations not covered by the
	 * StorageAdapter interface.
	 */
	getRepository(): Repository<EscrowContract> {
		return this.repository;
	}
}
