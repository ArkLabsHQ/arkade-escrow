import * as request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { hashes, utils as secpUtils } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { AppModule } from "../src/app.module";
import { createTestArkWallet, signupAndGetJwt, TestArkWallet } from "./utils";
import { SingleKey, Transaction, Wallet } from "@arkade-os/sdk";
import { execSync } from "node:child_process";
import { base64 } from "@scure/base";

hashes.sha256 = sha256;

/** Test helpers from https://github.com/arkade-os/ts-sdk/blob/master/test/e2e/utils.ts **/
const arkdExec =
	process.env.ARK_ENV === "docker" ? "docker exec -t arkd" : "nigiri";

function faucetOffchain(address: string, amount: number): void {
	execCommand(
		`${arkdExec} ark send --to ${address} --amount ${amount} --password secret`,
	);
}
function execCommand(command: string): string {
	command += " | grep -v WARN";
	const result = execSync(command).toString().trim();
	return result;
}
// before each test check if the ark's cli running in the test env has at least 20_000 offchain balance
// if not, fund it with 100.000
function beforeEachFaucet(): void {
	const balanceOutput = execCommand(`${arkdExec} ark balance`);
	const balance = JSON.parse(balanceOutput);
	const offchainBalance = balance.offchain_balance.total;

	if (offchainBalance <= 20_000) {
		const noteStr = execCommand(`${arkdExec} arkd note --amount 100000`);
		execCommand(`${arkdExec} ark redeem-notes -n ${noteStr} --password secret`);
	}
}

/* -------------- */

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

	beforeEach(beforeEachFaucet, 20000);

	it("should create an escrow request and contract from draft to created", async () => {
		const alice = await createTestArkWallet(secpUtils.randomSecretKey());
		const bob = await createTestArkWallet(secpUtils.randomSecretKey());

		const receiverToken = await signupAndGetJwt(app, alice.identity);
		const senderToken = await signupAndGetJwt(app, bob.identity);

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

		// On the CI we don't have access to arkd CLI for now
		if (process.env.CI) {
			return;
		}

		faucetOffchain(accepted.arkAddress, accepted.amount);

		await Promise.race([
			new Promise((resolve) =>
				setTimeout(async () => {
					console.log("Waiting for arkd to sync...");
					const getContractRes = await request(app.getHttpServer())
						.get(`/api/v1/escrows/contracts/${contractId}`)
						.set("Authorization", `Bearer ${receiverToken}`)
						.expect(200);

					expect(getContractRes.body).toBeDefined();
					expect(getContractRes.body.data).toBeDefined();
					expect(getContractRes.body.data.status).toBe("funded");
					resolve(undefined);
				}, 5000),
			),
			new Promise((_, reject) =>
				setTimeout(() => {
					reject();
				}, 10000),
			),
		]);

		const aliceAddress = await alice.wallet.getAddress();

		// funded, now the signatures
		const executionRes = await request(app.getHttpServer())
			.post(`/api/v1/escrows/contracts/${contractId}/execute`)
			.send({
				contractId: accepted.externalId,
				arkAddress: aliceAddress,
			})
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
	}, 20000);
});

async function signTx(
	base64Tx: string,
	checkpoints: string[],
	wallet: TestArkWallet,
) {
	const tx = Transaction.fromPSBT(base64.decode(base64Tx), {
		allowUnknown: true,
	});
	const signedTx = await wallet.identity.sign(tx);
	const ckpts = checkpoints.map(async (cp) => {
		const signed = await wallet.identity.sign(
			Transaction.fromPSBT(base64.decode(cp), { allowUnknown: true }),
			[0],
		);
		return base64.encode(signed.toPSBT());
	});
	return {
		arkTx: base64.encode(signedTx.toPSBT()),
		checkpoints: await Promise.all(ckpts),
	};
}
