import * as request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { hashes, utils as secpUtils } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2";
import { AppModule } from "../src/app.module";
import { signupAndGetJwt } from "./utils";

hashes.sha256 = sha256;

describe("Escrow creation from Request to contract", () => {
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

	it("should create an escrow request and contract from draft to created", async () => {
		const receiver = secpUtils.randomSecretKey();
		const sender = secpUtils.randomSecretKey();
		const receiverToken = await signupAndGetJwt(app, receiver);
		const senderToken = await signupAndGetJwt(app, sender);

		const payload = {
			side: "receiver",
			amount: 12345,
			description: "Test escrow creation",
			public: true,
		};

		// Create
		const createRes = await request(app.getHttpServer())
			.post("/api/v1/escrows/requests")
			.set("Authorization", `Bearer ${receiverToken}`)
			.send(payload)
			.expect(201);

		expect(createRes.body).toBeDefined();
		expect(createRes.body.data).toBeDefined();
		const { externalId, shareUrl } = createRes.body.data;

		expect(typeof externalId).toBe("string");
		expect(externalId.length).toBeGreaterThan(0);
		expect(typeof shareUrl).toBe("string");
		expect(shareUrl.endsWith(`/${externalId}`)).toBe(true);

		// Fetch back by id and assert fields
		const getRes = await request(app.getHttpServer())
			.get(`/api/v1/escrows/requests/${externalId}`)
			.set("Authorization", `Bearer ${receiverToken}`)
			.expect(200);

		expect(getRes.body).toBeDefined();
		expect(getRes.body.data).toBeDefined();

		const data = getRes.body.data;
		expect(data.externalId).toBe(externalId);
		expect(data.side).toBe(payload.side);
		expect(data.amount).toBe(payload.amount);
		expect(data.description).toBe(payload.description);
		expect(data.status).toBe("open");
		expect(data.public).toBe(true);
		expect(typeof data.createdAt).toBe("number");
		expect(data.createdAt).toBeGreaterThan(0);

		// Sender creates a draft Contract from the receiver's public request
		const draftRes = await request(app.getHttpServer())
			.post("/api/v1/escrows/contracts")
			.set("Authorization", `Bearer ${senderToken}`)
			.send({ requestId: externalId })
			.expect(201);

		expect(draftRes.body).toBeDefined();
		expect(draftRes.body.data).toBeDefined();
		const draft = draftRes.body.data;
		expect(typeof draft.externalId).toBe("string");
		expect(draft.externalId.length).toBeGreaterThan(0);
		expect(draft.requestId).toBe(externalId);
		expect(draft.status).toBe("draft");
		expect(draft.amount).toBe(payload.amount);
		expect(typeof draft.createdAt).toBe("number");
		expect(draft.createdAt).toBeGreaterThan(0);

		const contractId: string = draft.externalId;

		// Receiver accepts the draft Contract -> becomes "created"
		const acceptRes = await request(app.getHttpServer())
			.post(`/api/v1/escrows/contracts/${contractId}/accept`)
			.set("Authorization", `Bearer ${receiverToken}`)
			.expect(200);

		expect(acceptRes.body).toBeDefined();
		expect(acceptRes.body.data).toBeDefined();
		const accepted = acceptRes.body.data;
		expect(accepted.externalId).toBe(contractId);
		expect(accepted.requestId).toBe(externalId);
		expect(accepted.amount).toBe(payload.amount);
		expect(accepted.status).toBe("created");
		expect(typeof accepted.arkAddress).toBe("string");
		expect(accepted.arkAddress.length).toBeGreaterThan(0);
		expect(typeof accepted.createdAt).toBe("number");
		expect(typeof accepted.updatedAt).toBe("number");

		// Fetch the created contract to verify persisted state
		const getContractRes = await request(app.getHttpServer())
			.get(`/api/v1/escrows/contracts/${contractId}`)
			.set("Authorization", `Bearer ${receiverToken}`)
			.expect(200);

		expect(getContractRes.body).toBeDefined();
		expect(getContractRes.body.data).toBeDefined();
		expect(getContractRes.body.data.externalId).toBe(contractId);
		expect(getContractRes.body.data.status).toBe("created");
		expect(getContractRes.body.data.arkAddress).toBe(accepted.arkAddress);
	});
});
