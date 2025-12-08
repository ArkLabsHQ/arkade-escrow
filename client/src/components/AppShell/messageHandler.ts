import {
	DataMessage,
	InboundMessage,
	OutboundMessage,
} from "@/components/AppShell/types";

type Props = {};
type Result =
	| { tag: "success"; result: OutboundMessage | DataMessage }
	| { tag: "failure"; error: Error };
export default function makeMessageHandler(_: Props) {
	return async function messageHandler(
		message: InboundMessage,
	): Promise<Result> {
		switch (message.kind) {
			case "ARKADE_KEEP_ALIVE":
				return {
					tag: "success",
					result: {
						kind: "ARKADE_KEEP_ALIVE",
						timestamp: Date.now(),
					},
				};
			case "ARKADE_RPC_RESPONSE": {
				const { kind, method, payload } = message;
				switch (method) {
					case "get-x-public-key":
						if (payload.xOnlyPublicKey === null) {
							return {
								tag: "failure",
								error: new Error(`${message.kind}/${method} returned null`),
							};
						}
						return {
							tag: "success",
							result: {
								kind: "DATA",
								topic: "xOnlyPublicKey",
								xOnlyPublicKey: payload.xOnlyPublicKey,
							},
						};

					case "get-private-key":
						if (payload.privateKey === null) {
							return {
								tag: "failure",
								error: new Error(`${message.kind}/${method} returned null`),
							};
						}
						return {
							tag: "success",
							result: {
								kind: "DATA",
								topic: "privateKey",
								privateKey: payload.privateKey,
							},
						};

					case "get-ark-wallet-address":
						if (payload.arkAddress === null) {
							return {
								tag: "failure",
								error: new Error(`${message.kind}/${method} returned null`),
							};
						}
						return {
							tag: "success",
							result: {
								kind: "DATA",
								topic: "arkWalletAddress",
								arkWalletAddress: payload.arkAddress,
							},
						};

					case "get-ark-wallet-balance":
						if (payload.available === null) {
							return {
								tag: "failure",
								error: new Error(`${message.kind}/${method} returned null`),
							};
						}
						return {
							tag: "success",
							result: {
								kind: "DATA",
								topic: "arkWalletBalance",
								available: payload.available,
							},
						};

					case "sign-login-challenge":
						return {
							tag: "success",
							result: {
								kind: "DATA",
								topic: "signedChallenge",
								signedChallenge: payload.signedChallenge,
							},
						};
					case "sign-transaction":
						return {
							tag: "success",
							result: {
								kind: "DATA",
								topic: "signedTransaction",
								signedTransaction: payload,
							},
						};

					case "fund-address":
						return {
							tag: "success",
							result: {
								kind: "DATA",
								topic: "transactionId",
								txid: payload.txid,
							},
						};

					default:
						return {
							tag: "failure",
							error: new Error(`Unknown method ${method} for kind ${kind}`),
						};
				}
			}
		}
		return {
			tag: "failure",
			error: new Error("Unknown message"),
		};
	};
}
