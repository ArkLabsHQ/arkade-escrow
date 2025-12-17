import { Me } from "@/types/me";
import { getContractSideDetails } from "@/lib/utils";
import {
	GetArbitrationDto,
	GetEscrowContractDto,
	GetExecutionByContractDto,
} from "@/types/api";
import { Ban, CheckCircle, Flag, Hourglass, Scale, Zap } from "lucide-react";
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
	arbitration?: GetArbitrationDto;
	releaseAddres?: string;
};
export function StatusText({
	me,
	sideDetails: { mySide, createdByMe },
	status,
	currentExecution,
	arbitration,
	releaseAddres,
}: Props) {
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
			if (releaseAddres) {
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Zap className="text-accent" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								Contract is <b className="font-bold">funded</b> and can be
								executed!
							</p>
						</span>
					</div>
				);
			}
			if (mySide === "sender")
				return (
					<div className="flex items-center gap-3">
						<RowIcon>
							<Flag className="text-accent" />
						</RowIcon>
						<span className={textContainerStyle}>
							<p className="text-base font-medium text-foreground">
								Contract is <b className="font-bold">funded</b> but the release
								address is not set yet.
								<br />
								Please wait for the receiver to set it!
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
							Contract is <b className="font-bold">funded</b>.
							<br /> Please update the release address in the contract details
							to execute it.
						</p>
					</span>
				</div>
			);
		case "pending-execution": {
			console.log(currentExecution, releaseAddres, mySide);
			if (!currentExecution) {
				if (releaseAddres === undefined) {
					if (mySide === "sender") {
						return (
							<div className="flex items-center gap-3">
								<RowIcon>
									<Flag className="text-accent" />
								</RowIcon>
								<span className={textContainerStyle}>
									<p className="text-base font-medium text-foreground">
										Contract is <b className="font-bold">funded</b> but the
										release address is not set yet.
										<br />
										Please wait for the receiver to set it!
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
									Contract is <b className="font-bold">funded</b>.
									<br /> Please update the release address in the contract
									details to execute it.
								</p>
							</span>
						</div>
					);
				} else {
					// TODO: this is an error!
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
				}
			}
			// receiver must initiate execution
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
		case "under-arbitration": {
			switch (arbitration?.status) {
				case "pending":
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
				case "executed":
					return (
						<div className="flex items-center gap-3">
							<RowIcon>
								<Scale className="text-destructive" />
							</RowIcon>
							<span className={textContainerStyle}>
								<p className="text-base font-medium text-foreground">
									The arbitration verdict was
									<b className="font-bold"> {arbitration.verdict}</b> and it was
									fully executed.
									<br />
									Funds have been transferred to the ARK address provided.
								</p>
							</span>
						</div>
					);
				case "resolved": {
					const releaseFundsToMe =
						(arbitration.verdict === "release" && mySide === "receiver") ||
						(arbitration.verdict === "refund" && mySide === "sender");
					return (
						<div className="flex items-center gap-3">
							<RowIcon>
								<Scale className="text-destructive" />
							</RowIcon>
							<span className={textContainerStyle}>
								{releaseFundsToMe ? (
									<p className="text-sm font-medium text-foreground">
										The verdict is
										<b className="font-bold"> {arbitration.verdict}</b>, you can
										now confirm the{" "}
										<b className="font-bold">{arbitration.verdict} address</b>{" "}
										and execute the contract to receive the funds.
									</p>
								) : (
									<p className="text-sm font-medium text-foreground">
										The arbitration verdict is
										<b className="font-bold"> {arbitration.verdict}</b>.
									</p>
								)}
							</span>
						</div>
					);
				}
				default:
					return null;
			}
		}

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
