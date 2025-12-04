import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
	ArrowDownLeft,
	ArrowUpRight,
	Calendar,
	User,
	Copy,
	Wallet,
	CheckCircle,
	Zap,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { GetEscrowContractDto } from "@/types/api";
import { Me } from "@/types/me";
import { getContractSideDetails, shortKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ContractCardProps {
	contract: GetEscrowContractDto;
	onClick: () => void;
	me: Me;
}

export const ContractCard = ({ contract, onClick, me }: ContractCardProps) => {
	const formattedDate = format(contract.createdAt, "MMM dd, yyyy");

	const { mySide, createdByMe, counterParty } = getContractSideDetails(
		me,
		contract,
	);

	const renderSide = () => {
		return (
			<div className="flex items-center gap-3">
				<div className="flex flex-col">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-muted-foreground">
							{contract.side === "receiver" ? "Receiving from" : "Sending to"}
						</span>
					</div>

					<div className="flex items-center gap-2 mt-1">
						<User className="h-3.5 w-3.5 text-muted-foreground" />

						<span className="font-medium text-foreground">
							{shortKey(counterParty)}
						</span>
					</div>
				</div>
			</div>
		);
	};

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
			case "rejected-by-counterparty":
			case "canceled-by-creator":
			case "rescinded-by-counterparty":
			case "rescinded-by-creator":
			case "voided-by-arbiter":
			case "under-arbitration":
				return "bg-destructive/10 text-destructive border-destructive/20";
			default:
				return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
		}
	};

	const handleQuickAction = (e: React.MouseEvent) => {
		e.stopPropagation();

		// Quick action logic - will trigger the appropriate action

		onClick();
	};

	const renderFooterAction = () => {
		switch (contract.status) {
			case "created":
				return (
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs gap-1.5"
						onClick={handleQuickAction}
					>
						<Wallet className="h-3.5 w-3.5" />
						Fund
					</Button>
				);

			case "draft":
				return (
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs gap-1.5"
						onClick={handleQuickAction}
					>
						<CheckCircle className="h-3.5 w-3.5" />
						Accept
					</Button>
				);

			case "funded":
			case "pending-execution":
				return (
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs gap-1.5"
						onClick={handleQuickAction}
					>
						<Zap className="h-3.5 w-3.5" />
						Execute
					</Button>
				);

			default:
				return (
					<span className="text-xs text-muted-foreground">
						{format(contract.updatedAt, "MMM dd, yyyy - HH:mm")}
					</span>
				);
		}
	};

	function getStatusText(status: GetEscrowContractDto["status"]) {
		if (/reject|cancel|rescind|timed/.test(status)) return "canceled";
		switch (status) {
			case "pending-execution":
				return "ready";
			default:
				return status;
		}
	}

	return (
		<Card
			className="p-6 cursor-pointer transition-all hover:shadow-elegant hover:-translate-y-0.5 border-border bg-card"
			onClick={onClick}
		>
			<div className="flex flex-col gap-4">
				{/* Header Row */}
				<div className="flex items-start justify-between gap-4">
					{renderSide()}

					<Badge
						className={`${getStatusColor(contract.status)} w-24 justify-center truncate`}
					>
						{getStatusText(contract.status)}
					</Badge>
				</div>

				{/* Amount */}

				<p className="text-lg font-bold text-foreground">
					{`${contract.side === "receiver" ? "Receive" : "Send"} ${contract.amount} SAT`}
				</p>

				{/* Description */}
				<p className="text-sm text-muted-foreground line-clamp-2">
					{contract.description}
				</p>

				{/* Footer Row */}
				<div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Calendar className="h-3.5 w-3.5" />
						<span>{formattedDate}</span>
					</div>
					{renderFooterAction()}
				</div>
			</div>
		</Card>
	);
};
