import { ArkAddress } from "@arkade-os/sdk";

export type ContractId = string;

export type ContractAddressCreatedEvent = {
	eventId: string;
	contractId: ContractId;
	arkAddress: ArkAddress;
	createdAt: string; // ISO timestamp
};

export type ContractAddressFundedEvent = {
	eventId: string;
	contractId: ContractId;
	arkAddress: ArkAddress;
	amountSats: bigint; // or string to avoid bigint transport issues
	vtxoIds: string[]; // stable identifiers for dedup
	detectedAt: string;
};

export type ContractAddressVoidedEvent = {
	eventId: string;
	contractId: ContractId;
	arkAddress: ArkAddress;
	reason?: string;
	voidedAt: string;
};
