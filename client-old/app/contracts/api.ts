import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { attachAuthHeader } from "../account/api";

export type ApiPaginatedMeta = {
	nextCursor?: string;
	total: number;
};

export type ApiPaginatedEnvelope<T> = {
	data: T[];
	meta: ApiPaginatedMeta;
};

export type ApiEnvelope<T> = {
	data: T;
};

export type Transaction = {
	vtxo: {
		txid: string;
		vout: number;
		value: number;
	};
	arkTx: string; // The Ark transaction as PSBT
	checkpoints: string[]; // Checkpoint transactions as PSBTs
	requiredSigners: "sender" | "receiver" | "server" | "arbitrator"[];
	approvedByPubKeys: string[]; // List of pubkeys who have approved
	rejectedByPubKeys: string[]; // List of pubkeys who have rejected
};

export type ContractDto = {
	externalId: string;
	requestId: string;
	senderPublicKey: string;
	receiverPublicKey: string;
	amount: number;
	arkAddress?: string;
	status: string; // server's ContractStatus; keep generic on client
	cancelationReason?: string;
	createdAt: number;
	updatedAt: number;
	// Optional properties present on the DTO (not strictly needed for list)
	virtualCoins?: unknown[];
	lastExecution?: {
		id: number;
		externalId: string;
		contractExternalId: string;
		initiatedByPubKey: string;
		action: "dispute" | "direct-settle";
		status:
			| "pending-initiator-signature"
			| "pending-counterparty-signature"
			| "pending-server-confirmation"
			| "executed"
			| "canceled-by-initiator"
			| "rejected-by-counterparty";
		rejectionReason: string;
		cancelationReason: string;
		transaction: Transaction;
		createdAt: number;
		updatedAt: number;
	};
};

export const api = createApi({
	reducerPath: "contractsApi",
	baseQuery: fetchBaseQuery({
		baseUrl: "http://localhost:3002/api/v1/escrows/contracts",
		prepareHeaders: (headers, { getState }) => {
			// Inject Authorization header from the Account API helpers
			return attachAuthHeader(headers, getState());
		},
	}),
	endpoints: (builder) => ({
		fetchNextPage: builder.query<
			ApiPaginatedEnvelope<ContractDto>,
			{ cursor?: string; limit?: number }
		>({
			query: (params = {}) => ({
				// GET "" — returns authenticated user's contracts with pagination
				url: "",
				params,
			}),
			// Accumulate pages in a single cache entry, same pattern as orderbook
			serializeQueryArgs: ({ endpointName }) => endpointName,
			merge: (currentCache, newData) => {
				const existing = currentCache.data ?? [];
				const incoming = newData.data ?? [];

				// Deduplicate by externalId while preserving order
				const seen = new Set(existing.map((x) => x.externalId));
				const dedupedIncoming = incoming.filter((x) => {
					if (seen.has(x.externalId)) return false;
					seen.add(x.externalId);
					return true;
				});

				currentCache.data = [...existing, ...dedupedIncoming];
				currentCache.meta = newData.meta;
			},
			forceRefetch({ currentArg, previousArg }) {
				return (
					currentArg?.cursor !== previousArg?.cursor ||
					currentArg?.limit !== previousArg?.limit
				);
			},
			async onQueryStarted(arg, { dispatch, queryFulfilled }) {
				// If we're requesting the first page, clear the accumulated cache first
				if (!arg?.cursor) {
					dispatch(
						api.util.updateQueryData("fetchNextPage", {}, (draft) => {
							draft.data = [];
							draft.meta = { total: 0, nextCursor: undefined };
						}),
					);
				}
				try {
					await queryFulfilled;
				} catch {
					// no-op
				}
			},
		}),

		// getOne — GET ":externalId" — retrieves a single contract by ID
		getContractById: builder.query<ContractDto, string>({
			query: (externalId) => ({
				url: `${encodeURIComponent(externalId)}`,
			}),
			transformResponse: (response: ApiEnvelope<ContractDto>) => response.data,
		}),

		createFromRequest: builder.mutation<
			ApiEnvelope<ContractDto>,
			{ requestId: string }
		>({
			// POST "" — creates a draft contract from an escrow request
			query: (body) => ({
				url: "",
				method: "POST",
				body,
			}),
			async onQueryStarted(arg, { dispatch, queryFulfilled }) {
				try {
					const { data: created } = await queryFulfilled;
					// Merge the newly created contract into the accumulated list cache
					dispatch(
						api.util.updateQueryData("fetchNextPage", {}, (draft) => {
							const list = draft.data ?? [];
							const exists = list.some(
								(c) => c.externalId === created.data.externalId,
							);
							if (!exists) {
								draft.data = [created.data, ...list];
								draft.meta = {
									...(draft.meta ?? { total: 0 }),
									total: (draft.meta?.total ?? list.length) + 1,
								};
							}
						}),
					);
				} catch {
					// Swallow errors; component can handle via result.error
				}
			},
		}),
		acceptContract: builder.mutation<
			ApiEnvelope<ContractDto>,
			{ externalId: string }
		>({
			// POST ":externalId/accept" — accepts a draft contract
			query: ({ externalId }) => ({
				url: `${encodeURIComponent(externalId)}/accept`,
				method: "POST",
			}),
			async onQueryStarted({ externalId }, { dispatch, queryFulfilled }) {
				// After accepting, upsert the returned contract into the list cache
				try {
					const { data: resp } = await queryFulfilled;
					const accepted = resp.data;
					dispatch(
						api.util.updateQueryData("fetchNextPage", {}, (draft) => {
							const list = draft.data ?? [];
							const idx = list.findIndex((c) => c.externalId === externalId);
							if (idx >= 0) {
								list[idx] = { ...list[idx], ...accepted };
							} else {
								draft.data = [accepted, ...list];
								draft.meta = {
									...(draft.meta ?? { total: 0 }),
									total: (draft.meta?.total ?? list.length) + 1,
								};
							}
						}),
					);
				} catch {
					// no-op; let consumer handle error
				}
			},
		}),

		executeContract: builder.mutation<
			ApiEnvelope<unknown>,
			{ externalId: string; arkAddress: string }
		>({
			// POST ":externalId/execute" — initiates direct settlement execution
			query: ({ externalId, arkAddress }) => ({
				url: `${encodeURIComponent(externalId)}/execute`,
				method: "POST",
				body: { arkAddress },
			}),
		}),

		signContractExecution: builder.mutation<
			void,
			{
				contractId: string;
				executionId: string;
				arkTx: string;
				checkpoints: string[];
			}
		>({
			query: ({ contractId, executionId, arkTx, checkpoints }) => ({
				url: `${encodeURIComponent(contractId)}/executions/${encodeURIComponent(executionId)}`,
				method: "PATCH",
				body: { arkTx, checkpoints },
			}),
		}),
	}),
});

export const {
	useFetchNextPageQuery,
	useCreateFromRequestMutation,
	useAcceptContractMutation,
	useExecuteContractMutation,
	useGetContractByIdQuery,
	useSignContractExecutionMutation,
} = api;
