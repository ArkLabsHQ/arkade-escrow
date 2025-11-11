import * as request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { utils as secpUtils } from "@noble/secp256k1";
import { AppModule } from "../src/app.module";
import {
	createEscrowRequestBody,
	createTestArkWallet,
	signupAndGetJwt,
	TestArkWallet,
} from "./utils";
import { ArkAddress } from "@arkade-os/sdk";

describe("Escrow from Request to all Contract statuses before funding", () => {
	let app: INestApplication;
	let alice: TestArkWallet;
	let receiverToken: string;
	let bob: TestArkWallet;
	let senderToken: string;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
		alice = await createTestArkWallet(secpUtils.randomSecretKey());
		receiverToken = await signupAndGetJwt(app, alice.identity);
		bob = await createTestArkWallet(secpUtils.randomSecretKey());
		senderToken = await signupAndGetJwt(app, bob.identity);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("when creating a Request as `receiver`", () => {
		let requestId: string;

		beforeAll(async () => {
			// Create request
			const createRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/requests")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ ...createEscrowRequestBody, side: "receiver" })
				.expect(201);
			requestId = createRes.body.data.externalId;
		});

		it("should create a Contract with status `draft`", async () => {
			const draftContractRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ requestId })
				.expect(201);
			const contractId: string = draftContractRes.body.data.externalId;
			expect(typeof contractId).toBe("string");
			expect(draftContractRes.body.data.status).toBe("draft");
		});

		it("should move a draft Contract to the status `created` upon acceptance", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ requestId })
				.expect(201);
			const acceptedContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/accept`)
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);

			expect(acceptedContractRes.body.data.status).toBe("created");
			expect(
				ArkAddress.decode(acceptedContractRes.body.data.arkAddress),
			).toBeDefined();
			expect(acceptedContractRes.body.data.amount).toEqual(
				createEscrowRequestBody.amount,
			);
		});

		it("should move a draft Contract to the status `rejected-by-counterparty` upon rejection by the receiver", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ requestId })
				.expect(201);
			const rejectedContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/reject`)
				.send({ reason: "rejected by receiver" })
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);
			expect(rejectedContractRes.body.data.status).toBe(
				"rejected-by-counterparty",
			);
			expect(rejectedContractRes.body.data.arkAddress).toBeNull();
		});

		it("should move a draft Contract to the status `created` upon cancelation by the sender", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ requestId })
				.expect(201);
			const canceledContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/cancel`)
				.send({ reason: "rejected by sender" })
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);
			expect(canceledContractRes.body.data.status).toBe("canceled-by-creator");
			expect(canceledContractRes.body.data.arkAddress).toBeNull();
		});

		it("should move a created Contract to the status `receded` upon recession by the sender", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ requestId })
				.expect(201);
			await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/accept`)
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);
			const recededContract = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/recede`)
				.send({ reason: "sender recedes" })
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);
			expect(recededContract.body.data.status).toBe("rescinded-by-creator");
		});

		it("should move a created Contract to the status `receded` upon recession by the receiver", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ requestId })
				.expect(201);
			await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/accept`)
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);
			const recededContract = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/recede`)
				.send({ reason: "receiver recedes" })
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);
			expect(recededContract.body.data.status).toBe(
				"rescinded-by-counterparty",
			);
		});
	});

	describe("when creating a Request as `sender`", () => {
		let requestId: string;

		beforeAll(async () => {
			// Create request
			const createRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/requests")
				.set("Authorization", `Bearer ${senderToken}`)
				.send({ ...createEscrowRequestBody, side: "sender" })
				.expect(201);
			requestId = createRes.body.data.externalId;
		});

		it("should create a Contract with status `draft`", async () => {
			const draftContractRes = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ requestId })
				.expect(201);
			const contractId: string = draftContractRes.body.data.externalId;
			expect(typeof contractId).toBe("string");
			expect(draftContractRes.body.data.status).toBe("draft");
		});

		it("should move a draft Contract to the status `created` upon acceptance", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ requestId })
				.expect(201);
			const acceptedContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/accept`)
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);

			expect(acceptedContractRes.body.data.status).toBe("created");
			expect(
				ArkAddress.decode(acceptedContractRes.body.data.arkAddress),
			).toBeDefined();
			expect(acceptedContractRes.body.data.amount).toEqual(
				createEscrowRequestBody.amount,
			);
		});

		it("should move a draft Contract to the status `rejected-by-counterparty` upon rejection by the receiver", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ requestId })
				.expect(201);
			const rejectedContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/reject`)
				.send({ reason: "rejected by receiver" })
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);
			expect(rejectedContractRes.body.data.status).toBe(
				"rejected-by-counterparty",
			);
			expect(rejectedContractRes.body.data.arkAddress).toBeNull();
		});

		it("should move a draft Contract to the status `created` upon cancelation by the sender", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ requestId })
				.expect(201);
			const canceledContractRes = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/cancel`)
				.send({ reason: "rejected by sender" })
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);
			expect(canceledContractRes.body.data.status).toBe("canceled-by-creator");
			expect(canceledContractRes.body.data.arkAddress).toBeNull();
		});

		it("should move a created Contract to the status `receded` upon recession by the receiver", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ requestId })
				.expect(201);
			await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/accept`)
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);
			const recededContract = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/recede`)
				.send({ reason: "sender recedes" })
				.set("Authorization", `Bearer ${receiverToken}`)
				.expect(200);
			expect(recededContract.body.data.status).toBe("rescinded-by-creator");
		});

		it("should move a created Contract to the status `receded` upon recession by the sender", async () => {
			const { body } = await request(app.getHttpServer())
				.post("/api/v1/escrows/contracts")
				.set("Authorization", `Bearer ${receiverToken}`)
				.send({ requestId })
				.expect(201);
			await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/accept`)
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);
			const recededContract = await request(app.getHttpServer())
				.patch(`/api/v1/escrows/contracts/${body.data.externalId}/recede`)
				.send({ reason: "receiver recedes" })
				.set("Authorization", `Bearer ${senderToken}`)
				.expect(200);
			expect(recededContract.body.data.status).toBe(
				"rescinded-by-counterparty",
			);
		});
	});
});
