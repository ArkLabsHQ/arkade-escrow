import { Point } from "@noble/secp256k1";

export function normalizeToXOnly(pubHex: string): string {
	const h = pubHex.toLowerCase();
	if (h.length === 64) return h;
	const point = Point.fromHex(h);
	const compressed = point.toBytes(true);
	const x = compressed.slice(1);
	return Buffer.from(x).toString("hex");
}
