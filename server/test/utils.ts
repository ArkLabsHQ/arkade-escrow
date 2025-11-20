import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import * as request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Identity, SingleKey, Transaction, Wallet } from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";
import { hashes } from "@noble/secp256k1";
import { execSync } from "node:child_process";

hashes.sha256 = sha256;

/** Test helpers from https://github.com/arkade-os/ts-sdk/blob/master/test/e2e/utils.ts **/
export const arkdExec =
	process.env.ARK_ENV === "docker" ? "docker exec -t arkd" : "nigiri";

export function faucetOffchain(address: string, amount: number): void {
	console.log(
		`Fauceting via ${arkdExec} ark send --to ${address} --amount ${amount} --password secret`,
	);
	execCommand(
		`${arkdExec} ark send --to ${address} --amount ${amount} --password secret`,
	);
}
export function execCommand(command: string): string {
	command += " | grep -v WARN";
	const result = execSync(command).toString().trim();
	return result;
}
// before each test check if the ark's cli running in the test env has at least 20_000 offchain balance
// if not, fund it with 100.000
export function beforeEachFaucet(): void {
	// On the CI we don't have access to arkd CLI for now
	if (process.env.CI) {
		return;
	}
	const balanceOutput = execCommand(`${arkdExec} ark balance`);
	const balance = JSON.parse(balanceOutput);
	const offchainBalance = balance.offchain_balance.total;

	if (offchainBalance <= 20_000) {
		const noteStr = execCommand(`${arkdExec} arkd note --amount 100000`);
		execCommand(`${arkdExec} ark redeem-notes -n ${noteStr} --password secret`);
	}
}

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

export async function signTx(
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

export const createEscrowRequestBody = {
	side: "receiver",
	amount: 12345,
	description: "Test escrow creation",
	public: true,
};
