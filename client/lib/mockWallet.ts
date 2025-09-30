/**
 * Mock wallet handlers for local testing.
 * Replace these with real wallet/SDK wiring.
 */

function strToUint8(str: string): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < out.length; i++) out[i] = str.charCodeAt(i % str.length) & 0xff;
  return out;
}

export const mockHandlers = {
  async xOnlyPublicKey() {
    // 32-byte "pubkey" derived from a seed
    return strToUint8("arkade-mock-xonly-pubkey");
  },
  async sign(tx: unknown, inputIndexes?: number[]) {
    // Echo the tx and attach a mock "signed" flag
    return { ...((typeof tx === "object" && tx) || { tx }), signed: true, inputIndexes };
  },
  async signerSession() {
    return { sessionId: "mock-session", createdAt: new Date().toISOString() };
  },
  async signin(params: unknown) {
    return { token: "mock-jwt", params, userId: "user_123" };
  },
  async signout() {
    return { ok: true };
  },
};
