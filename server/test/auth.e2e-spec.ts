import * as request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { utils as secpUtils, hashes } from "@noble/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { AppModule } from "../src/app.module";
import { createTestArkWallet } from "./utils";
import { hex } from "@scure/base";

hashes.sha256 = sha256;

/**
 * This test is redundant because ./utils/signupAndGetJwt does exactly the same things,
 * but here we perform specific assertions about the API and it will help in debugging when things go south.
 */
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
		const alice = await createTestArkWallet(secpUtils.randomSecretKey());
		const pubCompressedHex = await alice.identity
			.xOnlyPublicKey()
			.then(hex.encode);

		// 1) request challenge
		const chalRes = await request(app.getHttpServer())
			.post("/api/v1/auth/signup/challenge")
			.set("Origin", "http://localhost:test")
			.send({ publicKey: pubCompressedHex })
			.expect(201);

		expect(chalRes.body.challengeId).toBeDefined();
		expect(chalRes.body.hashToSignHex).toHaveLength(64);

		// 2) sign hash
		const signatureBytes = await alice.identity.signMessage(
			hexToBytes(chalRes.body.hashToSignHex),
			"schnorr",
		);

		// 3) verify
		const verifyRes = await request(app.getHttpServer())
			.post("/api/v1/auth/signup/verify")
			.set("Origin", "http://localhost:test")
			.send({
				publicKey: pubCompressedHex,
				signature: bytesToHex(signatureBytes),
				challengeId: chalRes.body.challengeId,
			})
			.expect(201);

		expect(verifyRes.body.accessToken).toBeDefined();
		expect(verifyRes.body.userId).toBeDefined();
		expect(verifyRes.body.publicKey).toBeDefined();
	});
});
