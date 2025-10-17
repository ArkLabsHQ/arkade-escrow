import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import * as request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Point } from "@noble/secp256k1";
import { Identity } from "@arkade-os/sdk";
import { hex } from "@scure/base";

export function normalizeToXOnly(pubHex: string): string {
	const h = pubHex.toLowerCase();
	if (h.length === 64) return h;
	const point = Point.fromHex(h);
	const compressed = point.toBytes(true);
	const x = compressed.slice(1);
	return Buffer.from(x).toString("hex");
}

export async function signupAndGetJwt(
	app: INestApplication,
	identity: Identity,
) {
	const pubCompressedHex = await identity.xOnlyPublicKey().then(hex.encode);
	// .compressedPublicKey()
	// .then((x) => normalizeToXOnly(hex.encode(x)));

	const chalRes = await request(app.getHttpServer())
		.post("/api/v1/auth/signup/challenge")
		.set("Origin", "http://localhost:test")
		.send({ publicKey: pubCompressedHex })
		.expect(201);

	const signatureBytes = await identity.signMessage(
		hexToBytes(chalRes.body.hashToSignHex),
		"schnorr",
	);

	const verifyRes = await request(app.getHttpServer())
		.post("/api/v1/auth/signup/verify")
		.set("Origin", "http://localhost:test")
		.send({
			publicKey: pubCompressedHex,
			signature: bytesToHex(signatureBytes),
			challengeId: chalRes.body.challengeId,
		})
		.expect(201);

	return verifyRes.body.accessToken as string;
}
