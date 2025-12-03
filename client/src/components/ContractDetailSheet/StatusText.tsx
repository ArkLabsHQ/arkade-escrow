import { Me } from "@/types/me";
import { getContractSideDetails } from "@/lib/utils";
import { GetEscrowContractDto, GetExecutionByContractDto } from "@/types/api";
import { Ban, CheckCircle, Flag, Hourglass, Scale } from "lucide-react";
import { RowIcon } from "@/components/ContractDetailSheet/RowIcon";

const getStatusColor = (status: GetEscrowContractDto["status"]) => {
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

const textContainerStyle = "flex flex-grow items-center";

type Props = {
	me: Me;
	sideDetails: Pick<
		ReturnType<typeof getContractSideDetails>,
		"mySide" | "createdByMe"
	>;
	status: GetEscrowContractDto["status"];
	currentExecution?: GetExecutionByContractDto;
};
export function StatusText({
	me,
	sideDetails: { mySide, createdByMe },
	status,
	currentExecution,
}: Props) {
	// 						<p className="text-base font-medium text-foreground">
	// 						</p>
	switch (status) {
		case "completed":
			if (mySide === "sender") {
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<CheckCircle className="text-success" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								The transaction was submitted successfully.
							</p>
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<CheckCircle className="h-6 w-6 text-success" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							The transaction was submitted successfully. Please check the
							balance at the <b>release address</b>.
						</p>
					</span>
				</div>
			);
		case "funded":
			return "Contract is funded and can be executed";
		case "pending-execution": {
			if (!currentExecution)
				// TODO: this is an error state on the server, we should never get here
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Hourglass className="text-muted-foreground" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								Transaction is being created, please reload the page to check.
							</p>
						</span>
					</div>
				);
			if (currentExecution.status === "pending-server-confirmation") {
				// TODO: this is an error state on the server, we should never get here
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Hourglass className="text-muted-foreground" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								Waiting for the server to confirm the transaction.
							</p>
						</span>
					</div>
				);
			}
			const approvedByMe = currentExecution.transaction.approvedByPubKeys.some(
				(_) => me.isMyPubkey(_),
			);
			if (approvedByMe)
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Hourglass className="text-muted-foreground" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								<b className="font-bold">Waiting</b> for the counterparty to
								approve
							</p>
						</span>
					</div>
				);
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<Flag className="text-accent" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							<b className="font-bold">Waiting for you</b> to approve!
						</p>
					</span>
				</div>
			);
		}
		case "created":
			if (mySide === "sender") {
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Flag className="text-accent" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								<b className="font-bold">Waiting for you</b> to fund it!
							</p>
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<Hourglass className="text-muted-foreground" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							<b className="font-bold">Waiting</b> for funds
						</p>
					</span>
				</div>
			);
		case "draft":
			if (createdByMe) {
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Hourglass className="text-muted-foreground" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								<b className="font-bold">Waiting</b> for the counterparty to
								accept it
							</p>
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<Flag className="text-accent" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							<b className="font-bold">Waiting for you</b> to accept it
						</p>
					</span>
				</div>
			);
		case "under-arbitration":
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<Scale className="text-destructive" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							The contract has been
							<b className="font-bold"> disputed</b> and is now under
							arbitration.
							<br />
							Please wait for the arbitrator to decide.
						</p>
					</span>
				</div>
			);

		case "canceled-by-creator":
			if (createdByMe) {
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Ban className="text-destructive" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								The contract was canceled by you
							</p>
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<Ban className="text-destructive" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							The contract was canceled by the creator
						</p>
					</span>
				</div>
			);
		case "rejected-by-counterparty":
			if (createdByMe) {
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Ban className="text-destructive" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								The contract was rejected by the counterparty
							</p>
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<Ban className="text-destructive" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							The contract was rejected by you
						</p>
					</span>
				</div>
			);
		case "rescinded-by-creator":
			if (createdByMe) {
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Ban className="text-destructive" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								You rescinded the contract
							</p>
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<Ban className="text-destructive" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							The contract was rescinded by the creator
						</p>
					</span>
				</div>
			);
		case "rescinded-by-counterparty":
			if (createdByMe) {
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Ban className="text-destructive" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								The contract was rescinded by the counterparty
							</p>
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-3">
					<RowIcon>
						<Ban className="text-destructive" />
					</RowIcon>
					<span className={textContainerStyle}>
						<p className="text-base font-medium text-foreground">
							You rescinded the contract
						</p>
					</span>
				</div>
			);

		default:
			return <p>{status}</p>;
	}
}
