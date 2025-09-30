import { schnorr, utils as secpUtils, getPublicKey } from "@noble/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import * as request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Bytes } from "@scure/btc-signer/utils";

export async function signupAndGetJwt(app: INestApplication, priv: Bytes) {
	const pubCompressedHex = Buffer.from(getPublicKey(priv, true)).toString(
		"hex",
	);

	const chalRes = await request(app.getHttpServer())
		.post("/api/v1/auth/signup/challenge")
		.set("Origin", "http://localhost:test")
		.send({ publicKey: pubCompressedHex })
		.expect(201);

	const signatureHex = schnorr.sign(
		hexToBytes(chalRes.body.hashToSignHex),
		priv,
	);

	const verifyRes = await request(app.getHttpServer())
		.post("/api/v1/auth/signup/verify")
		.set("Origin", "http://localhost:test")
		.send({
			publicKey: pubCompressedHex,
			signature: bytesToHex(signatureHex),
			challengeId: chalRes.body.challengeId,
		})
		.expect(201);

	return verifyRes.body.accessToken as string;
}
