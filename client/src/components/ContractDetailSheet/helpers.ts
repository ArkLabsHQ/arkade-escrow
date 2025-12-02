import {
	GetArbitrationDto,
	GetEscrowContractDto,
	GetExecutionByContractDto,
} from "@/types/api";
import { Me } from "@/types/me";
import { getContractSideDetails } from "@/lib/utils";

export const getStatusColor = (status: GetEscrowContractDto["status"]) => {
	switch (status) {
		case "completed":
			return "bg-success/10 text-success border-success/20";
		case "funded":
		case "pending-execution":
			return "bg-primary/10 text-primary border-primary/20";
		case "created":
			return "bg-blue-500/10 text-blue-500 border-blue-500/20";
		case "draft":
			return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
		case "canceled-by-creator":
		case "rejected-by-counterparty":
		case "voided-by-arbiter":
		case "under-arbitration":
			return "bg-destructive/10 text-destructive border-destructive/20";
		default:
			return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
	}
};

export const getArbitrationStatusColor = (
	status: GetArbitrationDto["status"],
) => {
	switch (status) {
		case "pending":
			return "bg-warning/10 text-warning border-warning/20";
		case "resolved":
			return "bg-success/10 text-success border-success/20";
		case "executed":
			return "bg-primary/10 text-primary border-primary/20";
		default:
			return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
	}
};

export const getStatusText = (
	me: Me,
	{
		mySide,
		createdByMe,
	}: Pick<ReturnType<typeof getContractSideDetails>, "mySide" | "createdByMe">,
	status: GetEscrowContractDto["status"],
	currentExecution?: GetExecutionByContractDto,
) => {
	switch (status) {
		case "completed":
			return "Completed";
		case "funded":
			return "Contract is funded and can be executed";
		case "pending-execution": {
			if (!currentExecution) return "Pending execution";
			if (currentExecution.status === "pending-server-confirmation") {
				return "Waiting for the server to confirm the transaction";
			}
			const missingMySignature =
				currentExecution.transaction.approvedByPubKeys.some((_) =>
					me.isMyPubkey(_),
				);
			if (missingMySignature) return "Waiting for your approval";
			return "The counterparty has not signed the transaction yet";
		}
		case "created":
			if (mySide === "sender") {
				return "Created, waiting for funds";
			}
			return "Created, waiting for funds";
		case "draft":
			if (createdByMe) {
				return "Draft, waiting for the counterparty to accept it";
			}
			return "Draft, waiting for you to accept it";
		case "canceled-by-creator":
			if (createdByMe) {
				return "The contract was canceled by you";
			}
			return "The contract was canceled by the creator";
		case "rejected-by-counterparty":
			if (createdByMe) {
				return "The contract was rejected by the counterparty";
			}
			return "The contract was rejected by you";
		case "rescinded-by-creator":
			if (createdByMe) {
				return "You rescinded the contract";
			}
			return "The contract was rescinded by the creator";
		case "rescinded-by-counterparty":
			if (createdByMe) {
				return "The contract was rescinded by the counterparty";
			}
			return "You rescinded the contract";

		default:
			return status;
	}
};
