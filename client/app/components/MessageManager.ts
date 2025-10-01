type KeepAlive = { kind: "ARKADE_KEEP_ALIVE"; timestamp: number };

type RpcLoginRequest = {
	method: "sign-login-challenge";
	payload: {
		challenge: string;
	};
};
type RpcLoginResponse = {
	method: "sign-login-challenge";
	payload: {
		signedChallenge: string;
	};
};

type RpcXPublicKeyRequest = {
	method: "get-x-public-key";
};
type RpcXPublicKeyResponse = {
	method: "get-x-public-key";
	payload: {
		xOnlyPublicKey: string | null;
	};
};

type RpcArkWalletAddressRequest = {
	method: "get-ark-wallet-address";
};
type RpcArkWalletAddressResponse = {
	method: "get-ark-wallet-address";
	payload: {
		arkAddress: string | null;
	};
};

type RpcRequest = {
	kind: "ARKADE_RPC_REQUEST";
	id: string;
} & (RpcXPublicKeyRequest | RpcLoginRequest | RpcArkWalletAddressRequest);
type RpcResponse = { kind: "ARKADE_RPC_RESPONSE"; id: string } & (
	| RpcLoginResponse
	| RpcXPublicKeyResponse
	| RpcArkWalletAddressResponse
);

type InboundMessage = RpcResponse | KeepAlive;

type OutboundMessage = KeepAlive | RpcRequest;
type DataMessage = { kind: "DATA" } & (
	| { topic: "xOnlyPublicKey"; xOnlyPublicKey: string }
	| { topic: "signedChallenge"; signedChallenge: string }
	| { topic: "arkWalletAddress"; arkWalletAddress: string }
);

type Props = {};
type Result =
	| { tag: "success"; result: OutboundMessage | DataMessage }
	| { tag: "failure"; error: Error };
export default function makeMessageHandler(props: Props) {
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
				const { id, kind, method, payload } = message;
				console.log("[escrow] RPC response", { id, kind, method, payload });
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

					case "sign-login-challenge":
						return {
							tag: "success",
							result: {
								kind: "DATA",
								topic: "signedChallenge",
								signedChallenge: payload.signedChallenge,
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
		return { tag: "failure", error: new Error("Unknown message") };
	};
}
