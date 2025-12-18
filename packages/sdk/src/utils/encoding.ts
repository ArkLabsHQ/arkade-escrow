/**
 * Encoding utilities for the SDK
 */

import { hex, base64 } from "@scure/base";

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
	return hex.encode(bytes);
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hexString: string): Uint8Array {
	return hex.decode(hexString);
}

/**
 * Convert bytes to base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
	return base64.encode(bytes);
}

/**
 * Convert base64 string to bytes
 */
export function base64ToBytes(base64String: string): Uint8Array {
	return base64.decode(base64String);
}

/**
 * Convert a string to bytes using UTF-8 encoding
 */
export function stringToBytes(str: string): Uint8Array {
	return new TextEncoder().encode(str);
}

/**
 * Convert bytes to string using UTF-8 encoding
 */
export function bytesToString(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes);
}

/**
 * Concatenate multiple byte arrays
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
	const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

/**
 * Check if two byte arrays are equal
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}
