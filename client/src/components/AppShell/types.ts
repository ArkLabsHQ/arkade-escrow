export type KeepAlive = { kind: "ARKADE_KEEP_ALIVE"; timestamp: number };

export type RpcLoginRequest = {
	method: "sign-login-challenge";
	payload: {
		challenge: string;
	};
};
export type RpcLoginResponse = {
	method: "sign-login-challenge";
	payload: {
		signedChallenge: string;
	};
};

export type RpcXPublicKeyRequest = {
	method: "get-x-public-key";
};
export type RpcXPublicKeyResponse = {
	method: "get-x-public-key";
	payload: {
		xOnlyPublicKey: string | null;
	};
};

export type RpcArkWalletAddressRequest = {
	method: "get-ark-wallet-address";
};
export type RpcArkWalletAddressResponse = {
	method: "get-ark-wallet-address";
	payload: {
		arkAddress: string | null;
	};
};

export type RpcArkWalletBalanceRequest = {
	method: "get-ark-wallet-balance";
};
export type RpcArkWalletBalanceResponse = {
	method: "get-ark-wallet-balance";
	payload: {
		available: number | null;
	};
};

export type RpcArkSignTransactionRequest = {
	method: "sign-transaction";
	payload: {
		// Base64
		tx: string;
		// Base64
		checkpoints: string[];
	};
};
export type RpcArkSignTransactionResponse = {
	method: "sign-transaction";
	payload: {
		// Base64
		tx: string;
		// Base64
		checkpoints: string[];
	};
};

export type RpcFundAddressRequest = {
	method: "fund-address";
	payload: {
		// Ark address
		address: string;
		// SAT
		amount: number;
	};
};
export type RpcFundAddressResponse = {
	method: "fund-address";
	payload: {
		txid: string;
	};
};

export type RpcGetPrivateKeyRequest = {
	method: "get-private-key";
};
export type RpcGetPrivateKeyResponse = {
	method: "get-private-key";
	payload: {
		privateKey: string;
	};
};

export type RpcRequest = {
	kind: "ARKADE_RPC_REQUEST";
	id: string;
} & (
	| RpcXPublicKeyRequest
	| RpcLoginRequest
	| RpcArkWalletAddressRequest
	| RpcArkWalletBalanceRequest
	| RpcArkSignTransactionRequest
	| RpcFundAddressRequest
	| RpcGetPrivateKeyRequest
);
export type RpcResponse = { kind: "ARKADE_RPC_RESPONSE"; id: string } & (
	| RpcLoginResponse
	| RpcXPublicKeyResponse
	| RpcArkWalletAddressResponse
	| RpcArkWalletBalanceResponse
	| RpcArkSignTransactionResponse
	| RpcFundAddressResponse
	| RpcGetPrivateKeyResponse
);

export type InboundMessage = RpcResponse | KeepAlive;

export type OutboundMessage = KeepAlive | RpcRequest;
export type DataMessage = { kind: "DATA" } & (
	| { topic: "xOnlyPublicKey"; xOnlyPublicKey: string }
	| { topic: "privateKey"; privateKey: string }
	| { topic: "signedChallenge"; signedChallenge: string }
	| { topic: "arkWalletAddress"; arkWalletAddress: string }
	| { topic: "arkWalletBalance"; available: number }
	| {
			topic: "signedTransaction";
			signedTransaction: { tx: string; checkpoints: string[] };
	  }
	| { topic: "transactionId"; txid: string }
);
