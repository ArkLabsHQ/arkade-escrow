import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GetEscrowContractDto, Side } from "@/types/api";
import { Me } from "@/types/me";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const shortKey = (k: string) =>
	k.length > 14 ? `${k.slice(0, 10)}…${k.slice(-6)}` : k;

export const getCounterParty = (
	me: Me,
	contract: GetEscrowContractDto,
): { yourSide: Side; counterParty: string; createdByMe: boolean } => {
	if (contract.side === "receiver") {
		if (me.isMyPubkey(contract.receiverPublicKey)) {
			return {
				createdByMe: contract.createdBy === "receiver",
				yourSide: "receiver",
				counterParty: contract.senderPublicKey,
			};
		}
		return {
			createdByMe: contract.createdBy === "sender",
			yourSide: "sender",
			counterParty: contract.receiverPublicKey,
		};
	}
	if (me.isMyPubkey(contract.senderPublicKey)) {
		return {
			createdByMe: contract.createdBy === "sender",
			yourSide: "sender",
			counterParty: contract.receiverPublicKey,
		};
	}
	return {
		createdByMe: contract.createdBy === "receiver",
		yourSide: "receiver",
		counterParty: contract.senderPublicKey,
	};
};
