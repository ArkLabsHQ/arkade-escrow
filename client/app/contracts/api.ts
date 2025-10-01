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
	lastExecution?: unknown;
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
	}),
});

export const { useFetchNextPageQuery } = api;
