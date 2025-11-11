// TODO: generate from OpenAPI spec

import { VirtualCoin } from "@arkade-os/sdk";
import { ApiProperty } from "@nestjs/swagger";

export type ApiPaginatedMeta = {
	nextCursor?: string;
	total: number;
};

export type ApiPaginatedEnvelope<T> = {
	data: T[];
	meta: ApiPaginatedMeta;
};

export type ApiEnvelope<T> = {
	data: T;
};

export type Side = "sender" | "receiver";

export type GetEscrowRequestDto = {
	externalId: string;
	side: Side;
	creatorPublicKey: string;
	amount: number;
	description: string;
	public: boolean;
	status: "open" | "canceled";
	contractsCount: number;
	createdAt: number;
};

type ContractStatus =
	// first status, missing addresses
	| "draft"
	// all addresses are set, but no unspent VTXO
	| "created"
	// at least one unspent VTXO is present for the ARK address
	| "funded"
	// execution created
	| "pending-execution"
	// all unspent VTXO have been spent
	| "completed"

	// not funded in time
	| "timed-out-funding"
	// sender didn't sign the spending path
	| "timed-out-sender"
	// receiver didn't sign the spending path
	| "timed-out-receiver"

	//
	| "canceled-by-creator"
	| "rejected-by-counterparty"
	| "rescinded-by-creator"
	| "rescinded-by-counterparty"
	// canceled by the arbiter
	| "voided-by-arbiter"

	// dispute
	| "under-arbitration";

export type GetEscrowContractDto = {
	externalId: string;
	requestId: string;
	senderPublicKey: string;
	receiverPublicKey: string;
	amount: number;
	side: Side;
	description: string;
	arkAddress?: string;
	status: ContractStatus;
	cancelationReason?: string;
	virtualCoins?: VirtualCoin[];
	createdBy: string;
	createdAt: number;
	updatedAt: number;
};

export type Signers = "sender" | "receiver" | "server" | "arbitrator";

export type ExecutionTransaction = {
	vtxo: {
		txid: string;
		vout: number;
		value: number;
	};
	arkTx: string; // The Ark transaction as PSBT
	checkpoints: string[]; // Checkpoint transactions as PSBTs
	requiredSigners: Signers[];
	approvedByPubKeys: string[]; // List of pubkeys who have approved
	rejectedByPubKeys: string[]; // List of pubkeys who have rejected
};

export type ExecutionStatus =
	| "pending-initiator-signature"
	| "pending-counterparty-signature"
	| "pending-server-confirmation"
	| "executed"

	// voided
	| "canceled-by-initiator"
	| "rejected-by-counterparty";

export type GetExecutionByContractDto = {
	externalId: string;
	initiatedByPubKey: string;
	status: ExecutionStatus;
	rejectionReason?: string;
	cancelationReason?: string;
	transaction: ExecutionTransaction;
	createdAt: number;
	updatedAt: number;
};

export type ExecuteEscrowContractOutDto = {
	externalId: string;
	contractId: string;
	arkTx: string;
	checkpoints: string[];
	vtxo: {
		txid: string;
		vout: number;
		value: number;
	};
};

export type GetArbitrationDto = {
	externalId: string;
	contractId: string;
	claimantPublicKey: string;
	arbitratorPublicKey: string;
	reason: string;
	status: "pending" | "resolved" | "executed";
	verdict: "refund" | "release";
	createdAt: number;
	updatedAt: number;
};
