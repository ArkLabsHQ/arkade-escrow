import { useState } from "react";
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
import { AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { ContractAction } from "@/components/ContractDetailSheet";

interface ContractActionModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	actionType: ContractAction;
	onConfirm: (data?: { reason?: string }) => void;
}

export const ContractActionModal = ({
	open,
	onOpenChange,
	actionType,
	onConfirm,
}: ContractActionModalProps) => {
	const [reason, setReason] = useState("");

	const handleConfirm = () => {
		if (
			actionType === "reject" ||
			actionType === "dispute" ||
			actionType === "recede"
		) {
			onConfirm({ reason });
		} else {
			onConfirm();
		}
		setReason("");
		onOpenChange(false);
	};

	const getConfig = () => {
		switch (actionType) {
			case "accept":
				return {
					icon: <CheckCircle className="h-12 w-12 text-success" />,
					title: "Accept Contract",
					description:
						"You're about to accept the contract. This will create the contract ARK address and notify the counterparty.",
					requiresInput: false,
					confirmText: "Accept Contract",
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
					title: "Approve Settlement",
					description:
						"You're about to approve the settlement. This will complete the contract and release the funds.",
					requiresInput: false,
					confirmText: "Approve Settlement",
					confirmVariant: "default" as const,
				};
			case "reject":
				return {
					icon: <AlertTriangle className="h-12 w-12 text-destructive" />,
					title: "Reject Contract",
					description:
						"Please provide a reason for rejecting this contract. This action cannot be undone.",
					requiresInput: true,
					inputLabel: "Reason for rejection",
					inputPlaceholder: "Explain why you're rejecting this contract...",
					confirmText: "Reject Contract",
					confirmVariant: "destructive" as const,
				};
			case "recede":
				return {
					icon: <AlertTriangle className="h-12 w-12 text-muted-foreground" />,
					title: "Recede from Contract",
					description:
						"Please provide a reason for receding from this contract.",
					requiresInput: true,
					inputLabel: "Reason for receding",
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
					inputPlaceholder: "Describe the issue in detail...",
					confirmText: "Open Dispute",
					confirmVariant: "destructive" as const,
				};
			default:
				throw new Error(`Invalid action type ${actionType}`);
		}
	};

	const config = getConfig();
	const isConfirmDisabled = config.requiresInput && !reason.trim();

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
						<Label htmlFor="reason">{config.inputLabel}</Label>
						{/** biome-ignore lint/correctness/useUniqueElementIds: is unique */}
						<Textarea
							id="reason"
							placeholder={config.inputPlaceholder}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
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
							setReason("");
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
