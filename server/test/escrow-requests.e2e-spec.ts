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

	it("should create a public Request as a receiver and allow cancelation", async () => {
		const createRes = await request(app.getHttpServer())
			.post("/api/v1/escrows/requests")
			.set("Authorization", `Bearer ${receiverToken}`)
			.send({ ...createEscrowRequestBody, side: "receiver" })
			.expect(201);
		expect(typeof createRes.body.data.externalId).toBe("string");
		expect(typeof createRes.body.data.shareUrl).toBe("string");
		const getOrderbookRes = await request(app.getHttpServer())
			.get("/api/v1/escrows/requests/orderbook")
			.expect(200);
		expect(getOrderbookRes.body.data.length).toBe(1);
		expect(getOrderbookRes.body.data[0].status).toBe("open");
		await request(app.getHttpServer())
			.get(`/api/v1/escrows/requests/${createRes.body.data.externalId}`)
			.set("Authorization", `Bearer ${receiverToken}`)
			.expect(200);
		await request(app.getHttpServer())
			.patch(
				`/api/v1/escrows/requests/${createRes.body.data.externalId}/cancel`,
			)
			.set("Authorization", `Bearer ${receiverToken}`)
			.expect(200);
		const getOneRes = await request(app.getHttpServer())
			.get(`/api/v1/escrows/requests/${createRes.body.data.externalId}`)
			.set("Authorization", `Bearer ${receiverToken}`)
			.expect(200);
		expect(getOneRes.body.data.status).toBe("canceled");
	});

	it("should create a public Request as a sender and allow cancelation", async () => {
		const createRes = await request(app.getHttpServer())
			.post("/api/v1/escrows/requests")
			.set("Authorization", `Bearer ${senderToken}`)
			.send({ ...createEscrowRequestBody, side: "sender" })
			.expect(201);
		expect(typeof createRes.body.data.externalId).toBe("string");
		expect(typeof createRes.body.data.shareUrl).toBe("string");
		const getOrderbookRes = await request(app.getHttpServer())
			.get("/api/v1/escrows/requests/orderbook")
			.expect(200);
		expect(getOrderbookRes.body.data.length).toBe(1);
		expect(getOrderbookRes.body.data[0].status).toBe("open");
		await request(app.getHttpServer())
			.get(`/api/v1/escrows/requests/${createRes.body.data.externalId}`)
			.set("Authorization", `Bearer ${senderToken}`)
			.expect(200);
		await request(app.getHttpServer())
			.patch(
				`/api/v1/escrows/requests/${createRes.body.data.externalId}/cancel`,
			)
			.set("Authorization", `Bearer ${senderToken}`)
			.expect(200);
		const getOneRes = await request(app.getHttpServer())
			.get(`/api/v1/escrows/requests/${createRes.body.data.externalId}`)
			.set("Authorization", `Bearer ${senderToken}`)
			.expect(200);
		expect(getOneRes.body.data.status).toBe("canceled");
	});
});
