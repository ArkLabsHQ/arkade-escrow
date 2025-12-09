export type AuthData = {
	accessToken: string;
	xPubKey: string;
	expiresAt: number;
};

export function setAuth(data: AuthData): void {
	localStorage.setItem("ark:auth", JSON.stringify(data));
}

export function removeAuth(): void {
	localStorage.removeItem("ark:auth");
}

export function getAuth() {
	const data = localStorage.getItem("ark:auth");
	return data ? (JSON.parse(data) as AuthData) : null;
}

export async function encryptAndStorePrivateKey(
	privateKeyHex: string,
	password?: string,
): Promise<void> {
	const enc = new TextEncoder();

	// Random salt for PBKDF2
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// Derive key from password
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveKey"],
	);

	const aesKey = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt,
			iterations: 150_000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt"],
	);

	// AES-GCM IV
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Encrypt
	const ciphertextBuffer = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		aesKey,
		enc.encode(privateKeyHex),
	);

	const ciphertext = btoa(
		String.fromCharCode(...new Uint8Array(ciphertextBuffer)),
	);

	// Persist as JSON
	localStorage.setItem(
		"ark:encryptedPrivKey",
		JSON.stringify({
			salt: Array.from(salt),
			iv: Array.from(iv),
			ciphertext,
		}),
	);
}

export async function loadAndDecryptPrivateKey(
	password?: string,
): Promise<string | null> {
	const raw = localStorage.getItem("ark:encryptedPrivKey");
	if (!raw) return null;
	const data = JSON.parse(raw);
	if (!data) return null;

	const enc = new TextEncoder();
	const dec = new TextDecoder();

	const salt = new Uint8Array(data.salt);
	const iv = new Uint8Array(data.iv);
	const ciphertextBinary = Uint8Array.from(atob(data.ciphertext), (c) =>
		c.charCodeAt(0),
	);

	// Derive the same key
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveKey"],
	);

	const aesKey = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt,
			iterations: 150_000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["decrypt"],
	);

	// Decrypt
	try {
		const plaintextBuffer = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv },
			aesKey,
			ciphertextBinary,
		);

		return dec.decode(plaintextBuffer); // your hex string
	} catch (e) {
		console.error("Wrong password or corrupted data");
		return null;
	}
}

export function removeEncryptedPrivateKey(): void {
	localStorage.removeItem("ark:encryptedPrivKey");
}
