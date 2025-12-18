import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
	ArrowDownToLine,
	ArrowUpFromLine,
	User,
	Calendar,
	Bitcoin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GetEscrowRequestDto } from "@/types/api";
import { Me } from "@/types/me";

type RequestCardProps = {
	request: GetEscrowRequestDto;
	onClick: () => void;
	me: Me;
};

export const RequestCard = ({ me, request, onClick }: RequestCardProps) => {
	const formatSatoshi = (amount: number) => {
		return new Intl.NumberFormat("en-US").format(amount);
	};

	return (
		<Card
			className="p-6 cursor-pointer transition-all duration-300 hover:shadow-glow hover:-translate-y-1 bg-card border-border/50"
			onClick={onClick}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 space-y-3">
					{/* Side Badge */}
					<div className="flex items-center gap-2">
						{request.side === "receiver" ? (
							<ArrowDownToLine className="h-4 w-4 text-success" />
						) : (
							<ArrowUpFromLine className="h-4 w-4 text-primary" />
						)}
						<Badge
							variant={request.side === "receiver" ? "secondary" : "default"}
						>
							{request.side === "receiver" ? "Receiving" : "Sending"}
						</Badge>
					</div>

					{/* Description */}
					<p className="text-sm text-muted-foreground line-clamp-2 w-48 sm:w-56 md:w-full overflow-ellipsis whitespace-nowrap overflow-hidden">
						{request.description}
					</p>

					{/* Meta Information */}
					<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
						<div className="flex items-center gap-1">
							<User className="h-3 w-3" />
							<span>{me.pubkeyAsMe(request.creatorPublicKey)}</span>
						</div>
						<div className="flex items-center gap-1">
							<Calendar className="h-3 w-3" />
							<span>
								{formatDistanceToNow(request.createdAt, { addSuffix: true })}
							</span>
						</div>
					</div>
				</div>

				{/* Amount */}
				<div className="flex flex-col items-end gap-1">
					<div className="flex items-center gap-1 text-lg font-semibold text-foreground">
						<Bitcoin className="h-5 w-5 text-primary" />
						<span>{formatSatoshi(request.amount)}</span>
					</div>
					<span className="text-xs text-muted-foreground">SAT</span>
				</div>
			</div>
		</Card>
	);
};
