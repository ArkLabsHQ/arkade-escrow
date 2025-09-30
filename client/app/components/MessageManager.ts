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
	method: "get-x-publick-key";
};
type RpcXPublicKeyResponse = {
	method: "get-x-publick-key";
	payload: {
		xOnlyPublicKey: string | null;
	};
};

type RpcRequest = {
	kind: "ARKADE_RPC_REQUEST";
	id: string;
} & (RpcXPublicKeyRequest | RpcLoginRequest);
type RpcResponse = { kind: "ARKADE_RPC_RESPONSE"; id: string } & (
	| RpcLoginResponse
	| RpcXPublicKeyResponse
);

type InboundMessage = RpcResponse | KeepAlive;

type OutboundMessage = KeepAlive | RpcRequest;
type DataMessage = { kind: "DATA" } & (
	| { topic: "xOnlyPublicKey"; xOnlyPublicKey: string }
	| { topic: "signedChallenge"; signedChallenge: string }
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
					case "get-x-publick-key":
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
