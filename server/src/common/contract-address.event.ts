import { ArkAddress, VirtualCoin } from "@arkade-os/sdk";

export type ContractId = string;

export const CONTRACT_DRAFTED_ID = "contract.drafted";
export type ContractDrafted = {
	eventId: string;
	contractId: ContractId;
	senderPubkey: string;
	receiverPubkey: string;
	createdAt: string; // ISO timestamp
};

export const CONTRACT_CREATED_ID = "contract.created";
export type ContractCreated = {
	eventId: string;
	contractId: ContractId;
	arkAddress: ArkAddress;
	createdAt: string; // ISO timestamp
};

export const CONTRACT_FUNDED_ID = "contract.funded";
export type ContractFunded = {
	eventId: string;
	contractId: ContractId;
	arkAddress: ArkAddress;
	amountSats: bigint; // or string to avoid bigint transport issues
	vtxos: VirtualCoin[];
	detectedAt: string;
};

export const CONTRACT_VOIDED_ID = "contract.voided";
export type ContractVoided = {
	eventId: string;
	contractId: ContractId;
	arkAddress?: ArkAddress;
	reason?: string;
	voidedAt: string;
};

export const CONTRACT_EXECUTED_ID = "contract.executed";
export type ContractExecuted = {
	eventId: string;
	contractId: ContractId;
	arkAddress: ArkAddress;
	executedAt: string;
};

export const CONTRACT_DISPUTED = "contract.disputed";
export type ContractDisputed = {
	eventId: string;
	contractId: ContractId;
	arbitrationId: string;
	disputedAt: string;
};
