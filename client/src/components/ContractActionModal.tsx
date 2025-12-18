import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
	AlertTriangle,
	Banknote,
	CheckCircle,
	PencilLine,
	Shield,
} from "lucide-react";
import { ContractAction } from "@/components/ContractDetailSheet/ContractActions";

type InputId =
	// generic reason for rejecting/cancelling/receding contracts
	| "reason"
	// reason for creating a dispute
	| "disputeReason"
	// the release ARK address of a generic contract
	| "releaseAddress"
	// the ARK address to transfer funds to upon dispute resolution
	| "arbitrationTransferAddress";

type ContractActionModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	actionType: ContractAction;
	data: {
		amount?: number;
		walletAddress?: string;
		currentReleaseAddress?: string;
	};
	onConfirm: (data?: { [K in InputId]?: string }) => void;
};

const getConfig = (
	actionType: ContractAction,
	data: ContractActionModalProps["data"],
) => {
	switch (actionType) {
		case "accept-draft":
			return {
				icon: <CheckCircle className="h-12 w-12 text-success" />,
				title: "Accept Contract",
				description:
					"You're about to accept the contract. This will create the contract ARK address and notify the counterparty.",
				requiresInput: false,
				confirmText: "Accept Contract",
				confirmVariant: "default" as const,
			};
		case "reject-draft":
			return {
				icon: <AlertTriangle className="h-12 w-12 text-destructive" />,
				title: "Reject Contract",
				description:
					"You're about to reject the contract. This action cannot be undone.",
				requiresInput: true,
				inputLabel: "Reason for rejecting",
				inputId: "reason",
				inputPlaceholder: "Explain why you're rejecting this contract...",
				confirmText: "Reject Contract",
				confirmVariant: "destructive" as const,
			};
		case "cancel-draft":
			return {
				icon: <AlertTriangle className="h-12 w-12 text-destructive" />,
				title: "Cancel Contract",
				description:
					"You're about to cancel the contract. This action cannot be undone.",
				requiresInput: true,
				inputLabel: "Reason for canceling",
				inputId: "reason",
				inputPlaceholder: "Explain why you're canceling this contract...",
				confirmText: "Cancel Contract",
				confirmVariant: "destructive" as const,
			};
		case "fund-contract":
			return {
				icon: <Banknote className="h-12 w-12 text-success" />,
				title: "Send funds to contract address",
				description: `You're about to send ${data.amount} SAT. This action cannot be undone.`,
				requiresInput: false,
				confirmText: "Send funds",
				confirmVariant: "default" as const,
			};
		case "update-release-address":
			return {
				icon: <PencilLine className="h-12 w-12 text-success" />,
				title: "Update Release Address",
				description:
					"Please provide a new ARK address. The funds will be released to this address upon contract fulfillment.",
				requiresInput: true,
				inputLabel: "ARK Address",
				inputId: "releaseAddress",
				inputPlaceholder: "ARK address to release funds to.",
				inputDefaultValue: data.currentReleaseAddress ?? data.walletAddress,
				confirmText: "Update Release Address",
				confirmVariant: "default" as const,
			};
		case "execute":
			return {
				icon: <CheckCircle className="h-12 w-12 text-success" />,
				title: "Execute Contract",
				description:
					"You're about to initiate the execution process. The counterparty will need to approve this execution.",
				requiresInput: false,
				confirmText: "Initiate Execution",
				confirmVariant: "default" as const,
			};
		case "approve":
			return {
				icon: <CheckCircle className="h-12 w-12 text-success" />,
				title: "Approve Execution",
				description:
					"You're about to approve the execution. This will complete the contract and release the funds.",
				requiresInput: false,
				confirmText: "Approve Execution",
				confirmVariant: "default" as const,
			};
		case "recede-created":
			return {
				icon: <AlertTriangle className="h-12 w-12 text-muted-foreground" />,
				title: "Recede from Contract",
				description: "Please provide a reason for receding from this contract.",
				requiresInput: true,
				inputLabel: "Reason for receding",
				inputId: "reason",
				inputPlaceholder: "Explain why you're receding from this contract...",
				confirmText: "Recede from Contract",
				confirmVariant: "outline" as const,
			};
		case "dispute":
			return {
				icon: <Shield className="h-12 w-12 text-destructive" />,
				title: "Open Dispute",
				description:
					"Please provide detailed information about the issue. A dispute resolution process will be initiated.",
				requiresInput: true,
				inputLabel: "Dispute details",
				inputId: "disputeReason",
				inputPlaceholder: "Describe the issue in detail...",
				confirmText: "Open Dispute",
				confirmVariant: "destructive" as const,
			};
		case "create-execution-for-dispute":
			return {
				icon: <CheckCircle className="h-12 w-12 text-success" />,
				title: "Approve Dispute Execution",
				description:
					"You're about to approve the execution of this dispute. This will complete the contract and move the funds to the ARK address provided.",
				requiresInput: true,
				inputLabel: "ARK Address",
				inputId: "arbitrationTransferAddress", // can be either a release or a refund
				inputDefaultValue: data.walletAddress,
				inputPlaceholder: "ARK address to transfer the funds to.",
				confirmText: "Approve Dispute Execution",
				confirmVariant: "default" as const,
			};
		default:
			throw new Error(`Invalid action type ${actionType}`);
	}
};

export const ContractActionModal = ({
	open,
	onOpenChange,
	actionType,
	data,
	onConfirm,
}: ContractActionModalProps) => {
	const [inputData, setInputData] = useState<{
		id: InputId;
		content: string;
	} | null>();

	const handleConfirm = () => {
		onConfirm(inputData ? { [inputData.id]: inputData.content } : undefined);
		setInputData(null);
		onOpenChange(false);
	};

	const config = getConfig(actionType, data);

	useEffect(() => {
		if (config.inputDefaultValue !== undefined) {
			setInputData({
				id: config.inputId as InputId,
				content: config.inputDefaultValue,
			});
		}
	}, [config.inputId, config.inputDefaultValue]);

	const isConfirmDisabled = config.requiresInput && !inputData?.content?.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="space-y-4">
					<div className="flex justify-center">{config.icon}</div>
					<DialogTitle className="text-center text-2xl">
						{config.title}
					</DialogTitle>
					<DialogDescription className="text-center text-base">
						{config.description}
					</DialogDescription>
				</DialogHeader>

				{config.requiresInput && (
					<div className="space-y-2 py-4">
						<Label htmlFor={config.inputId}>{config.inputLabel}</Label>
						{/** biome-ignore lint/correctness/useUniqueElementIds: is unique */}
						<Textarea
							id={config.inputId}
							placeholder={config.inputPlaceholder}
							value={inputData?.content ?? ""}
							onChange={(e) =>
								setInputData({
									id: config.inputId as InputId,
									content: e.target.value,
								})
							}
							className="min-h-[100px] resize-none"
						/>
					</div>
				)}

				<DialogFooter className="flex-col sm:flex-col gap-2">
					<Button
						variant={config.confirmVariant}
						onClick={handleConfirm}
						disabled={isConfirmDisabled}
						className="w-full"
					>
						{config.confirmText}
					</Button>
					<Button
						variant="ghost"
						onClick={() => {
							setInputData(null);
							onOpenChange(false);
						}}
						className="w-full"
					>
						Cancel
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
