import { sha256 } from "@noble/hashes/sha2.js"
import { randomBytes } from "node:crypto";

export type ChallengePayload = {
	scope: "signup";
	nonce: string;
	issuedAt: string;
	origin: string;
};

export function createSignupChallenge(origin: string): {
	id: string;
	payload: ChallengePayload;
	hashHex: string;
} {
	const nonce = randomBytes(16).toString("hex");
	const issuedAt = new Date().toISOString();
	const id = randomBytes(8).toString("hex");

	const payload: ChallengePayload = {
		scope: "signup",
		nonce,
		issuedAt,
		origin,
	};
	const msg = `ARK-ESCROW signup\nnonce:${nonce}\nissuedAt:${issuedAt}\norigin:${origin}`;
	const hash = sha256(new TextEncoder().encode(msg));
	const hashHex = Buffer.from(hash).toString("hex");
	return { id, payload, hashHex };
}

export function hashSignupPayload(payload: ChallengePayload): string {
	const msg = `ARK-ESCROW signup\nnonce:${payload.nonce}\nissuedAt:${payload.issuedAt}\norigin:${payload.origin}`;
	const hash = sha256(new TextEncoder().encode(msg));
	return Buffer.from(hash).toString("hex");
}
