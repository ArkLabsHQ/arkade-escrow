import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

type ChallengeResponse = {
	challenge: {
		scope: "signup";
		nonce: "string";
		issuedAt: "string";
		origin: "string";
	};
	challengeId: "string";
	hashToSignHex: "string";
	expiresAt: "2025-09-30T16:36:33.774Z";
};

type VerifySignupRequest = {
	signature: string;
	publicKey: string;
	challengeId: string;
};
type VerifySignupResponse = {
	accessToken: string;
	userId: string;
	publicKey: string;
};

export const AUTH_FIXED_CACHE_KEY = "auth";

export const api = createApi({
	reducerPath: "accountApi",
	baseQuery: fetchBaseQuery({
		baseUrl: "http://localhost:3002/api/v1/auth",
	}),
	endpoints: (builder) => ({
		createSignupChallenge: builder.mutation<
			ChallengeResponse,
			{ origin: string; publicKey: string }
		>({
			query: ({ publicKey, origin }) => ({
				url: "signup/challenge",
				method: "POST",
				body: { publicKey },
				headers: { origin },
			}),
		}),
		verifySignupChallenge: builder.mutation<
			VerifySignupResponse,
			{ origin: string } & VerifySignupRequest
		>({
			query: ({ origin, signature, challengeId, publicKey }) => ({
				url: "signup/verify",
				method: "POST",
				body: { signature, challengeId, publicKey },
				headers: { origin },
			}),
		}),
	}),
});

export const {
	useCreateSignupChallengeMutation,
	useVerifySignupChallengeMutation,
} = api;

// helper: selector to read the cached access token from RTKQ mutation cache
export const selectAccessToken = (state: unknown): string | undefined => {
	// This relies on verifySignupChallenge being called with { fixedCacheKey: AUTH_FIXED_CACHE_KEY }
	// so all services can read the token from one stable cache entry.
	const sel = api.endpoints.verifySignupChallenge?.select(AUTH_FIXED_CACHE_KEY);
	console.log("selectAccessToken", state);
	const res = typeof sel === "function" ? sel(state as any) : undefined;
	return res?.data?.accessToken;
};

export const selectXPublicKey = (state: unknown): string | undefined => {
	// This relies on verifySignupChallenge being called with { fixedCacheKey: AUTH_FIXED_CACHE_KEY }
	// so all services can read the token from one stable cache entry.
	const sel = api.endpoints.verifySignupChallenge?.select(AUTH_FIXED_CACHE_KEY);
	console.log("selectAccessToken", state);
	const res = typeof sel === "function" ? sel(state as any) : undefined;
	return res?.data?.publicKey;
};

// optional: reusable helper to attach Authorization header (can be imported by other APIs)
export const attachAuthHeader = (headers: Headers, state: unknown) => {
	const token = selectAccessToken(state);
	console.log("attachAuthHeader", token);
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
};
