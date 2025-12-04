import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GetEscrowContractDto, Side } from "@/types/api";
import { Me } from "@/types/me";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const shortKey = (k: string) =>
	k.length > 14 ? `${k.slice(0, 10)}…${k.slice(-6)}` : k;

export const shortArkAddress = (a: string, n: number = 8) =>
	`${a.slice(0, n)}...${a.slice(-n)}`;

export const getContractSideDetails = (
	me: Me,
	contract: GetEscrowContractDto,
): { mySide: Side; counterParty: string; createdByMe: boolean } => {
	if (contract.side === "receiver") {
		if (me.isMyPubkey(contract.receiverPublicKey)) {
			return {
				createdByMe: contract.createdBy === "receiver",
				mySide: "receiver",
				counterParty: contract.senderPublicKey,
			};
		}
		return {
			createdByMe: contract.createdBy === "sender",
			mySide: "sender",
			counterParty: contract.receiverPublicKey,
		};
	}
	if (me.isMyPubkey(contract.senderPublicKey)) {
		return {
			createdByMe: contract.createdBy === "sender",
			mySide: "sender",
			counterParty: contract.receiverPublicKey,
		};
	}
	return {
		createdByMe: contract.createdBy === "receiver",
		mySide: "receiver",
		counterParty: contract.senderPublicKey,
	};
};
