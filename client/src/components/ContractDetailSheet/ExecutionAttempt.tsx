import { XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { shortKey } from "@/lib/utils";
import { GetExecutionByContractDto } from "@/types/api";
import { Me } from "@/types/me";

type Props = {
	execution: GetExecutionByContractDto;
	me: Me;
	isPast?: boolean;
};

export default function ExecutionAttempt({
	execution,
	me,
	isPast = false,
}: Props) {
	const variant = isPast ? "destructive" : "neutral";
	return (
		<div
			className={`bg-${variant}/5 border border-${variant}/20 rounded-lg p-3 space-y-2 animate-fade-in`}
		>
			<div className="flex items-start gap-2">
				<XCircle className={`h-4 w-4 text-${variant} mt-0.5 shrink-0`} />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<Badge
							variant="outline"
							className={`bg-${variant}/10 text-${variant} border-${variant}/20`}
						>
							{execution.status}
						</Badge>
						<span className="text-xs text-muted-foreground">
							{format(execution.createdAt, "PPp")}
						</span>
					</div>
					<p className="text-sm text-foreground mt-1">
						Initiated by{" "}
						<span className="font-medium">
							{me.pubkeyAsMe(execution.initiatedByPubKey)}
						</span>
					</p>
					{execution.cancelationReason && (
						<p className="text-xs text-muted-foreground mt-1 italic">
							"{execution.cancelationReason}"
						</p>
					)}
					{execution.rejectionReason && (
						<p className="text-xs text-muted-foreground mt-1 italic">
							"{execution.rejectionReason}"
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
