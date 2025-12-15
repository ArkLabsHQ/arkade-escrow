import * as request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { utils as secpUtils } from "@noble/secp256k1";
import { AppModule } from "../src/app.module";
import {
	beforeEachFaucet,
	createEscrowRequestBody,
	createTestArkWallet,
	E2E_TIMEOUT,
	faucetOffchain,
	signTx,
	signupAndGetJwt,
	sleep,
	TestArkWallet,
	waitForContractStatus,
} from "./utils";

describe("Escrow from Request to disputed Contract and resolution", () => {
	let app: INestApplication;
	let alice: TestArkWallet;
	let bob: TestArkWallet;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
		alice = await createTestArkWallet(secpUtils.randomSecretKey());
		bob = await createTestArkWallet(secpUtils.randomSecretKey());
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(beforeEachFaucet, 20000);

	it(
		"should complete a contract with verdict 'release'",
		async () => {
			const receiverToken = await signupAndGetJwt(app, alice.identity);
			const senderToken = await signupAndGetJwt(app, bob.identity);

			// Create request
			const createRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/requests")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ ...createEscrowRequestBody, side: "receiver" })
				.expect(201);

			const requestId: string = createRes.body.data.externalId;
			expect(typeof requestId).toBe("string");

			// Sender creates a draft Contract from the receiver's public request
			const draftContractRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ requestId })
				.expect(201);

			const contractId: string = draftContractRes.body.data.externalId;
			expect(typeof contractId).toBe("string");
			expect(draftContractRes.body.data.status).toBe("draft");

			// Receiver accepts the draft Contract -> becomes "created"
			const acceptedContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${contractId}/accept`)
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);

			expect(acceptedContractRes.body.data.status).toBe("created");
			expect(acceptedContractRes.body.data.arkAddress.length).toBeGreaterThan(
				0,
			);
			expect(acceptedContractRes.body.data.amount).toEqual(
				createEscrowRequestBody.amount,
			);

			// On the CI we don't have access to arkd CLI for now
			if (process.env.CI) {
				return;
			}

			faucetOffchain(
				acceptedContractRes.body.data.arkAddress,
				acceptedContractRes.body.data.amount,
			);

			// Give arkd time to sync + poll until the contract is funded
			await sleep(10_000);
			await waitForContractStatus({
				app,
				contractId,
				token: senderToken,
				expectedStatus: "funded",
				timeoutMs: 30_000,
				intervalMs: 1_000,
			});

			// funded, now the dispute can be initiated
			const arbitrationRes = await request(app.getHttpServer())
				.post(`/api/v1/escrows/arbitrations`)
				.send({
					contractId,
					reason: "e2e test dispute",
				})
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(201);

			const arbitrationId = arbitrationRes.body.data.externalId;
			expect(typeof arbitrationId).toBe("string");

			// admin declares a release
			const resolutionRes = await request(app.getHttpServer())
				.post(`/api/admin/v1/contracts/${contractId}/arbitrate`)
				.send({
					disputeId: arbitrationId,
					action: "release",
				})
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);

			expect(resolutionRes.body.data.externalId).toMatch(arbitrationId);

			// Alice (receiver) who disputed the contract can now execute the arbitration's resolution
			const aliceAddress = await alice.wallet.getAddress();

			const executionRes = await request(app.getHttpServer())
				.post(`/api/v1/escrows/arbitrations/${arbitrationId}/execute`)
				.send({ arkAddress: aliceAddress })
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(201);

			expect(executionRes.body).toBeDefined();
			expect(executionRes.body.data).toBeDefined();
			expect(executionRes.body.data.externalId).toBeDefined();

			const aliceSignature = await signTx(
				executionRes.body.data.arkTx,
				executionRes.body.data.checkpoints,
				alice,
			);

			await request(app.getHttpServer())
				.patch(
					`/api/v1/escrows/contracts/${contractId}/executions/${executionRes.body.data.externalId}`,
				)
				.send({
					arkTx: aliceSignature.arkTx,
					checkpoints: aliceSignature.checkpoints,
				})
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);

			const finalContract = await request(app.getHttpServer())
				.get(`/api/v1/escrows/contracts/${contractId}`)
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);

			expect(finalContract.body.data.status).toBe("completed");
		},
		E2E_TIMEOUT,
	);

	it(
		"should complete a contract with verdict 'refund'",
		async () => {
			const receiverToken = await signupAndGetJwt(app, alice.identity);
			const senderToken = await signupAndGetJwt(app, bob.identity);

			// Create request
			const createRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/requests")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ ...createEscrowRequestBody, side: "receiver" })
				.expect(201);

			const requestId: string = createRes.body.data.externalId;
			expect(typeof requestId).toBe("string");

			// Sender creates a draft Contract from the receiver's public request
			const draftContractRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ requestId })
				.expect(201);

			const contractId: string = draftContractRes.body.data.externalId;
			expect(typeof contractId).toBe("string");
			expect(draftContractRes.body.data.status).toBe("draft");

			// Receiver accepts the draft Contract -> becomes "created"
			const acceptedContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${contractId}/accept`)
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);

			expect(acceptedContractRes.body.data.status).toBe("created");
			expect(acceptedContractRes.body.data.arkAddress.length).toBeGreaterThan(
				0,
			);
			expect(acceptedContractRes.body.data.amount).toEqual(
				createEscrowRequestBody.amount,
			);

			// On the CI we don't have access to arkd CLI for now
			if (process.env.CI) {
				return;
			}

			faucetOffchain(
				acceptedContractRes.body.data.arkAddress,
				acceptedContractRes.body.data.amount,
			);

			// Give arkd time to sync + poll until the contract is funded
			await sleep(10_000);
			await waitForContractStatus({
				app,
				contractId,
				token: senderToken,
				expectedStatus: "funded",
				timeoutMs: 30_000,
				intervalMs: 1_000,
			});

			// funded, now the dispute can be initiated
			const arbitrationRes = await request(app.getHttpServer())
				.post(`/api/v1/escrows/arbitrations`)
				.send({
					contractId,
					reason: "e2e test dispute",
				})
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(201);

			const arbitrationId = arbitrationRes.body.data.externalId;
			expect(typeof arbitrationId).toBe("string");

			// admin declares a refund
			const resolutionRes = await request(app.getHttpServer())
				.post(`/api/admin/v1/contracts/${contractId}/arbitrate`)
				.send({
					disputeId: arbitrationId,
					action: "refund",
				})
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);

			expect(resolutionRes.body.data.externalId).toMatch(arbitrationId);

			// Bob (sender) who disputed the contract can now execute the arbitration's resolution
			const bobAddress = await bob.wallet.getAddress();

			const executionRes = await request(app.getHttpServer())
				.post(`/api/v1/escrows/arbitrations/${arbitrationId}/execute`)
				.send({ arkAddress: bobAddress })
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(201);

			expect(executionRes.body.data.externalId).toBeDefined();

			const bobSignature = await signTx(
				executionRes.body.data.arkTx,
				executionRes.body.data.checkpoints,
				bob,
			);

			await request(app.getHttpServer())
				.patch(
					`/api/v1/escrows/contracts/${contractId}/executions/${executionRes.body.data.externalId}`,
				)
				.send({
					arkTx: bobSignature.arkTx,
					checkpoints: bobSignature.checkpoints,
				})
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);

			const finalContract = await request(app.getHttpServer())
				.get(`/api/v1/escrows/contracts/${contractId}`)
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);

			expect(finalContract.body.data.status).toBe("completed");
		},
		E2E_TIMEOUT,
	);
});
