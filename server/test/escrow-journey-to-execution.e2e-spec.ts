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

describe("Escrow from Request to completed Contract", () => {
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
		"should complete a contract as a receiver",
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

			faucetOffchain(
				acceptedContractRes.body.data.arkAddress,
				acceptedContractRes.body.data.amount,
			);

			// Give arkd time to sync + poll until the contract is funded
			await sleep(10_000);
			await waitForContractStatus({
				app,
				contractId,
				token: receiverToken,
				expectedStatus: "funded",
				timeoutMs: 30_000,
				intervalMs: 1_000,
			});

			const aliceAddress = await alice.wallet.getAddress();

			// funded, now the signatures
			const executionRes = await request(app.getHttpServer())
				.post(`/api/v1/escrows/contracts/${contractId}/execute`)
				.send({
					contractId,
					arkAddress: aliceAddress,
				})
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(201);

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

			const executionSignedByAlice = await request(app.getHttpServer())
				.get(
					`/api/v1/escrows/contracts/${contractId}/executions/${executionRes.body.data.externalId}`,
				)
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);

			const bobSignature = await signTx(
				executionSignedByAlice.body.data.transaction.arkTx,
				executionSignedByAlice.body.data.transaction.checkpoints,
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

	it(
		"should complete a contract as a sender",
		async () => {
			const receiverToken = await signupAndGetJwt(app, alice.identity);
			const senderToken = await signupAndGetJwt(app, bob.identity);

			// Create request
			const createRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/requests")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ ...createEscrowRequestBody, side: "sender" })
				.expect(201);

			const requestId: string = createRes.body.data.externalId;
			expect(typeof requestId).toBe("string");

			// Receiver creates a draft Contract from the sender's public request
			const draftContractRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ requestId })
				.expect(201);

			const contractId: string = draftContractRes.body.data.externalId;
			expect(typeof contractId).toBe("string");
			expect(draftContractRes.body.data.status).toBe("draft");

			// Sender accepts the draft Contract -> becomes "created"
			const acceptedContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${contractId}/accept`)
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);

			expect(acceptedContractRes.body.data.status).toBe("created");
			expect(acceptedContractRes.body.data.arkAddress.length).toBeGreaterThan(
				0,
			);
			expect(acceptedContractRes.body.data.amount).toEqual(
				createEscrowRequestBody.amount,
			);

			// On the CI we don't have access to arkd CLI for now, stop here
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
			const aliceAddress = await alice.wallet.getAddress();

			// funded, now the signatures
			const executionRes = await request(app.getHttpServer())
				.post(`/api/v1/escrows/contracts/${contractId}/execute`)
				.send({
					contractId,
					arkAddress: aliceAddress,
				})
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(201);

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

			const executionSignedByAlice = await request(app.getHttpServer())
				.get(
					`/api/v1/escrows/contracts/${contractId}/executions/${executionRes.body.data.externalId}`,
				)
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);

			const bobSignature = await signTx(
				executionSignedByAlice.body.data.transaction.arkTx,
				executionSignedByAlice.body.data.transaction.checkpoints,
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
