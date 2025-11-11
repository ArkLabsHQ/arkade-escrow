export type RequestSide = "sender" | "receiver";

export interface EscrowRequest {
	externalId: string;
	side: RequestSide;
	creatorPublicKey: string;
	createdAt: Date;
	description: string;
	amount: number; // in SAT
	status: "open" | "canceled";
	contractsCount?: number; // Number of contracts created from this request
}

export interface PastSettlement {
	id: string;
	initiatedBy: string;
	initiatedAt: Date;
	status: "rejected" | "failed";
	reason?: string;
}

export interface Contract {
	id: string;
	externalId: string; // Used in URL
	requestId: string;
	createdAt: Date;
	status:
		| "draft"
		| "created"
		| "funded"
		| "pending-execution"
		| "completed"
		| "canceled";
	amount: number; // Requested amount in SAT
	fundedAmount?: number; // Actual amount funded at ARK address (only for funded/pending-execution)
	side: RequestSide;
	counterparty: string;
	arkAddress: string;
	description: string;
	pastSettlements?: PastSettlement[];
}

export type NotificationType =
	| "approve_contract"
	| "settle_transaction"
	| "new_settlement"
	| "contract_funded"
	| "contract_rejected"
	| "dispute";

export interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	description: string;
	createdAt: Date;
	read: boolean;
	actionUrl?: string;
}
