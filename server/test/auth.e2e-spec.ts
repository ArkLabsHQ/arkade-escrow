import * as request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import {
	schnorr,
	utils as secpUtils,
	getPublicKey,
	hashes,
} from "@noble/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha2.js";

import { AppModule } from "../src/app.module";

hashes.sha256 = sha256;

describe("Auth E2E (signup)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should create challenge and verify signature to return a JWT", async () => {
		// Generate a keypair
		const priv = secpUtils.randomSecretKey();
		const pubXOnlyHex = Buffer.from(getPublicKey(priv, true)).toString("hex"); // compressed
		// 1) request challenge
		const chalRes = await request(app.getHttpServer())
			.post("/api/v1/auth/signup/challenge")
			.set("Origin", "http://localhost:test")
			.send({ publicKey: pubXOnlyHex })
			.expect(201);

		expect(chalRes.body.challengeId).toBeDefined();
		expect(chalRes.body.hashToSignHex).toHaveLength(64);

		// 2) sign hash
		const signatureHex = schnorr.sign(
			hexToBytes(chalRes.body.hashToSignHex),
			priv,
		);

		// 3) verify
		const verifyRes = await request(app.getHttpServer())
			.post("/api/v1/auth/signup/verify")
			.set("Origin", "http://localhost:test")
			.send({
				publicKey: pubXOnlyHex,
				signature: bytesToHex(signatureHex),
				challengeId: chalRes.body.challengeId,
			})
			.expect(201);

		expect(verifyRes.body.accessToken).toBeDefined();
		expect(verifyRes.body.userId).toBeDefined();
		expect(verifyRes.body.publicKey).toBeDefined();
	});
});
