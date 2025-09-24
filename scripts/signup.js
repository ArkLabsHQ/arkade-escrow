const { schnorr, utils, getPublicKey, hashes } = require("@noble/secp256k1");
const { bytesToHex, hexToBytes } = require("@noble/hashes/utils");
const { sha256 } = require("@noble/hashes/sha2");

// CRITICAL: Set up hashing exactly like E2E test
hashes.sha256 = sha256;

// Import the normalizeToXOnly function to test it
const { Point } = require("@noble/secp256k1");

function normalizeToXOnly(pubHex) {
	const h = pubHex.toLowerCase();
	if (h.length === 64) return h;
	const point = Point.fromHex(h);
	const compressed = point.toBytes(true);
	const x = compressed.slice(1);
	return Buffer.from(x).toString("hex");
}

async function debugFlow() {
	const isLocal = process.argv.includes("--local");
	const baseUrl = isLocal
		? "http://localhost:3002/api/v1"
		: "http://api.escrow.mutinynet.arkade.sh/api/v1";

	try {
		console.log("1. Generating keypair...");
		const priv = utils.randomSecretKey();
		const pubCompressed = Buffer.from(getPublicKey(priv, true)).toString("hex");

		console.log("Private key (hex):", bytesToHex(priv));
		console.log("Public key (compressed):", pubCompressed);

		// Test the normalization
		const pubXOnly = normalizeToXOnly(pubCompressed);
		console.log("Public key (x-only):", pubXOnly);
		console.log("X-only length:", pubXOnly.length);

		console.log("\n2. Requesting challenge...");
		const challengeResponse = await fetch(`${baseUrl}/auth/signup/challenge`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "http://localhost:test",
			},
			body: JSON.stringify({ publicKey: pubCompressed }),
		});

		console.log("Challenge response status:", challengeResponse.status);
		console.log("Challenge response headers:", challengeResponse.headers);

		const challengeData = await challengeResponse.json();
		console.log("Challenge data:", challengeData);

		console.log("\n3. Signing...");
		const signatureBytes = schnorr.sign(
			hexToBytes(challengeData.hashToSignHex),
			priv,
		);
		const signatureHex = bytesToHex(signatureBytes);
		console.log("Signature:", signatureHex);

		console.log("\n4. Manual verification test...");
		// Let's manually verify the signature to see if it's correct
		const isValidSignature = schnorr.verify(
			hexToBytes(signatureHex),
			hexToBytes(challengeData.hashToSignHex),
			hexToBytes(pubXOnly), // Use x-only format for verification
		);
		console.log("Manual signature verification:", isValidSignature);

		console.log("\n5. API verification...");
		const verifyResponse = await fetch(`${baseUrl}/auth/signup/verify`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "http://localhost:test",
			},
			body: JSON.stringify({
				publicKey: pubCompressed, // Send compressed format
				signature: signatureHex,
				challengeId: challengeData.challengeId,
			}),
		});

		if (!verifyResponse.ok) {
			const errorText = await verifyResponse.text();
			console.log("API verification failed:", errorText);
		} else {
			const verifyData = await verifyResponse.json();
			console.log("✅ SUCCESS!", verifyData);
		}
	} catch (error) {
		console.error("❌ ERROR:", error);
	}
}

debugFlow();
