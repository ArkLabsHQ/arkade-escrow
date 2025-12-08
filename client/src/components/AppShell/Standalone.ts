import { InboundMessage, OutboundMessage } from "@/components/AppShell/types";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { Identity, Transaction } from "@arkade-os/sdk";
import { base64 } from "@scure/base";
import { AppShell, MessageEventLike } from "./RpcProvider";

const KEEP_ALIVE_INTERVAL = 5000;

export class Standalone implements AppShell {
	#isAlive = false;
	constructor(
		private onMessage: (m: MessageEventLike) => Promise<void>,
		private identity: Identity,
	) {}
	postMessage(message: OutboundMessage): void {
		if (message.kind === "ARKADE_KEEP_ALIVE") {
			if (!this.#isAlive) {
				this.#isAlive = true;
				// first keep alive answers immediately
				this.onMessage(
					this.#wrap({ kind: "ARKADE_KEEP_ALIVE", timestamp: Date.now() }),
				);
				return;
			}
			setTimeout(
				() =>
					this.onMessage(
						this.#wrap({ kind: "ARKADE_KEEP_ALIVE", timestamp: Date.now() }),
					),
				KEEP_ALIVE_INTERVAL,
			);
		}
		if (message.kind === "ARKADE_RPC_REQUEST") {
			const { id, method } = message;
			switch (message.method) {
				case "get-x-public-key":
					this.#answerPublicKey(id);
					return;
				case "sign-login-challenge":
					this.#signLoginChallenge(id, message.payload.challenge);
					return;
				case "sign-transaction":
					this.#signTransaction(
						id,
						message.payload.tx,
						message.payload.checkpoints,
					);
					return;
				case "get-private-key":
					this.#answerPrivateKey(id);
					return;
				default:
				// no-op
			}
		}
	}
	async #answerPublicKey(id: string) {
		const xOnlyPublicKey = await this.identity.xOnlyPublicKey();
		this.onMessage(
			this.#wrap({
				kind: "ARKADE_RPC_RESPONSE",
				id,
				method: "get-x-public-key",
				payload: { xOnlyPublicKey: bytesToHex(xOnlyPublicKey) },
			}),
		);
	}
	async #answerPrivateKey(id: string) {
		const privateKey = await this.identity.xOnlyPublicKey();
		this.onMessage(
			this.#wrap({
				kind: "ARKADE_RPC_RESPONSE",
				id,
				method: "get-private-key",
				payload: { privateKey: bytesToHex(privateKey) },
			}),
		);
	}
	async #signLoginChallenge(id: string, message: string) {
		const signedChallenge = await this.identity.signMessage(
			hexToBytes(message),
			"schnorr",
		);
		this.onMessage(
			this.#wrap({
				kind: "ARKADE_RPC_RESPONSE",
				id,
				method: "sign-login-challenge",
				payload: { signedChallenge: bytesToHex(signedChallenge) },
			}),
		);
	}
	async #signTransaction(
		id: string,
		base64Tx: string,
		base64Checkpoints: string[],
	) {
		const tx = Transaction.fromPSBT(base64.decode(base64Tx), {
			allowUnknown: true,
		});
		const checkpoints = base64Checkpoints.map((_) => base64.decode(_));
		const signedTx = await this.identity.sign(tx);
		const signedCheckpoints = await Promise.all(
			checkpoints.map(async (cp) => {
				const signed = await this.identity.sign(
					Transaction.fromPSBT(cp, { allowUnknown: true }),
				);
				return base64.encode(signed.toPSBT());
			}),
		);
		this.onMessage(
			this.#wrap({
				kind: "ARKADE_RPC_RESPONSE",
				id,
				method: "sign-transaction",
				payload: {
					tx: base64.encode(signedTx.toPSBT()),
					checkpoints: signedCheckpoints,
				},
			}),
		);
	}
	#wrap(data: InboundMessage) {
		return { origin: "app-shell", source: null, data };
	}
}
