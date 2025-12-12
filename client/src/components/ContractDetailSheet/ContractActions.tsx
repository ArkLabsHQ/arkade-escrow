import {
	GetArbitrationDto,
	GetEscrowContractDto,
	GetExecutionByContractDto,
} from "@/types/api";
import { Me } from "@/types/me";
import { Button } from "@/components/ui/button";
import { getContractSideDetails } from "@/lib/utils";

export type ContractAction =
	| "accept-draft"
	| "cancel-draft"
	| "reject-draft"
	| "update-release-address"
	| "fund-contract"
	| "execute"
	| "approve"
	| "recede-created"
	| "dispute"
	| "create-execution-for-dispute";

type Props = {
	me: Me;
	contractStatus: GetEscrowContractDto["status"];
	sideDetails: ReturnType<typeof getContractSideDetails>;
	currentExecution?: GetExecutionByContractDto;
	currentArbitration?: GetArbitrationDto;
	releaseAddress?: string;
	onClick: (ca: ContractAction) => void;
};
export default function ContractActions({
	me,
	contractStatus,
	sideDetails,
	currentExecution,
	currentArbitration,
	releaseAddress,
	onClick,
}: Props) {
	const createdByMe = sideDetails.createdByMe;

	switch (contractStatus) {
		case "draft":
			// creator: can cancel
			if (createdByMe) {
				return [
					<Button
						key={"cancel-draft"}
						variant="destructive"
						className="w-full"
						onClick={() => onClick("cancel-draft")}
					>
						Cancel Contract
					</Button>,
				];
			}
			// counterparty: can accept or reject
			return [
				<Button
					key={"accept-draft"}
					className="w-full"
					onClick={() => onClick("accept-draft")}
				>
					Accept Contract
				</Button>,
				<Button
					key={"reject-draft"}
					variant="destructive"
					className="w-full"
					onClick={() => onClick("reject-draft")}
				>
					Reject Contract
				</Button>,
			];

		case "created":
			// both can recede if it's not funded
			return [
				<Button
					key={"recede-created"}
					variant="outline"
					className="w-full"
					onClick={() => onClick("recede-created")}
				>
					Recede from Contract
				</Button>,
			];
		case "funded":
			if (!releaseAddress) {
				return [
					<Button
						key={"dispute-funded"}
						variant="destructive"
						className="w-full"
						onClick={() => onClick("dispute")}
					>
						Open Dispute
					</Button>,
				];
			}
			// both can execute or dispute
			return [
				<Button
					key={"execute-funded"}
					className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
					onClick={() => onClick("execute")}
				>
					Execute Contract
				</Button>,
				<Button
					key={"dispute-funded"}
					variant="destructive"
					className="w-full"
					onClick={() => onClick("dispute")}
				>
					Open Dispute
				</Button>,
			];
		case "pending-execution":
			// only dispute if already approved the execution
			if (
				currentExecution?.transaction.approvedByPubKeys.some((_) =>
					me.isMyPubkey(_),
				)
			) {
				return [
					<Button
						key={"dispute-funded"}
						variant="destructive"
						className="w-full"
						onClick={() => onClick("dispute")}
					>
						Open Dispute
					</Button>,
				];
			}
			// can approve or dispute
			return [
				<Button
					key={"approve-pending-execution"}
					className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
					onClick={() => onClick("approve")}
				>
					{"Approve Execution"}
				</Button>,
				<Button
					key={"dispute-funded"}
					variant="destructive"
					className="w-full"
					onClick={() => onClick("dispute")}
				>
					Open Dispute
				</Button>,
			];
		case "under-arbitration":
			// no verdict yet, can only wait
			if (!currentArbitration?.verdict) {
				return [];
			}
			// sender can execute a refund
			if (
				currentArbitration.verdict === "refund" &&
				sideDetails.mySide === "sender"
			) {
				return [
					<Button
						key={"execute-refund"}
						className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
						onClick={() => onClick("create-execution-for-dispute")}
					>
						Confirm Address and Execute Refund
					</Button>,
				];
			}
			// receiver can execute a release
			if (
				currentArbitration.verdict === "release" &&
				sideDetails.mySide === "receiver"
			) {
				return [
					<Button
						key={"execute-release"}
						className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
						onClick={() => onClick("create-execution-for-dispute")}
					>
						Confirm Address and Execute Release
					</Button>,
				];
			}
			// this should never happen
			return [];
		default:
			return [];
	}
}
