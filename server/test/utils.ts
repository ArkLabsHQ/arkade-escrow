import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import * as request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Identity, SingleKey, Wallet } from "@arkade-os/sdk";
import { hex } from "@scure/base";

export interface TestArkWallet {
	wallet: Wallet;
	identity: SingleKey;
}
function createTestIdentity(name: Uint8Array): SingleKey {
	return SingleKey.fromPrivateKey(name);
}
export async function createTestArkWallet(
	name: Uint8Array,
): Promise<TestArkWallet> {
	const identity = createTestIdentity(name);

	const wallet = await Wallet.create({
		identity,
		arkServerUrl: process.env.ARK_SERVER_URL ?? "http://localhost:7070",
	});

	return {
		wallet,
		identity,
	};
}

export async function signupAndGetJwt(
	app: INestApplication,
	identity: Identity,
) {
	const pubCompressedHex = await identity.xOnlyPublicKey().then(hex.encode);

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
