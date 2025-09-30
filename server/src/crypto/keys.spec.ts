import { getPublicKey } from "@noble/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { normalizeToXOnly } from "./keys";

describe("normalizeToXOnly", () => {
	it("converts compressed to x-only", () => {
		const priv = 1n;
		const privHex = priv.toString(16).padStart(64, "0");
		const privBytes = hexToBytes(privHex);
		const compressed = bytesToHex(getPublicKey(privBytes, true));
		const xOnly = normalizeToXOnly(compressed);
		expect(xOnly).toHaveLength(64);
	});
});
