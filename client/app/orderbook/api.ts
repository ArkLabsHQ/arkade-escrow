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

export type OrderbookItemDto = {
	externalId: string;
	side: "receiver" | "sender";
	creatorPublicKey: string;
	amount?: number;
	description: string;
	status: "open" | "cancelled";
	createdAt: number;
};

export type CreateEscrowRequestOutDto = OrderbookItemDto & {
	externalId: string;
	shareUrl: string;
};

export type CreateEscrowRequestInDto = {
	side: "receiver" | "sender";
	amount: number;
	description: string;
	public: boolean;
};

export type GetEscrowRequestDto = {
	externalId: string;
	side: "receiver" | "sender";
	creatorPublicKey: string;
	amount?: number;
	description: string;
	public: boolean;
	status: "open" | "cancelled";
	createdAt: number;
};

export const api = createApi({
	reducerPath: "orderbookApi",
	baseQuery: fetchBaseQuery({
		baseUrl: "http://localhost:3002/api/v1/escrows/requests",
		prepareHeaders: (headers, { getState }) => {
			return attachAuthHeader(headers, getState());
		},
	}),
	endpoints: (builder) => ({
		fetchNextPage: builder.query<
			ApiPaginatedEnvelope<OrderbookItemDto>,
			{ cursor?: string; limit?: number }
		>({
			query: (params = {}) => ({
				url: "orderbook",
				params,
			}),
			// Accumulate pages in a single cache entry
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
				// Refetch when cursor or limit changes
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
		createRequest: builder.mutation<
			CreateEscrowRequestOutDto,
			CreateEscrowRequestInDto
		>({
			query: (body) => ({
				url: "",
				method: "POST",
				body,
			}),
			transformResponse: (response: ApiEnvelope<CreateEscrowRequestOutDto>) =>
				response.data,
		}),
		getRequestById: builder.query<GetEscrowRequestDto, string>({
			query: (externalId) => ({
				url: `${externalId}`,
			}),
			transformResponse: (response: ApiEnvelope<GetEscrowRequestDto>) =>
				response.data,
		}),
	}),
});

export const {
	useFetchNextPageQuery,
	useCreateRequestMutation,
	useGetRequestByIdQuery,
} = api;
