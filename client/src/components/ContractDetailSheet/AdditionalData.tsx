import { Copy, FileSignature, FileText, User } from "lucide-react";
import { shortKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AdditionalData({
	createdByMe,
	counterParty,
	contractId,
	requestId,
	description,
	onCopyItem,
}: {
	createdByMe: boolean;
	counterParty: string;
	contractId: string;
	requestId: string;
	description: string;
	onCopyItem: (key: string, value: string) => Promise<void>;
}) {
	return (
		<>
			<div className="flex items-start gap-3">
				<div className="space-y-2">
					<div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border">
						<p className="text-base text-muted-foreground leading-relaxed pt-1">
							{description}
						</p>
					</div>
				</div>
			</div>
			<div className="flex items-start gap-3">
				<User className="h-5 w-5 text-muted-foreground mt-0.5" />
				{createdByMe ? (
					<div className="flex-1">
						<p className="text-sm text-muted-foreground">Counterparty</p>
						<p className="text-base font-medium text-foreground">
							{shortKey(counterParty)}
						</p>
					</div>
				) : (
					<div className="flex-1">
						<p className="text-sm text-muted-foreground">Created By</p>
						<p className="text-base font-medium text-foreground">
							{shortKey(counterParty)}
						</p>
					</div>
				)}
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onCopyItem("counterParty", counterParty)}
					className="shrink-0"
				>
					<Copy className="h-4 w-4" />
				</Button>
			</div>
			<div className="flex items-start gap-3">
				<FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
				<div className="flex-1">
					<p className="text-sm text-muted-foreground">Request ID</p>
					<p className="text-base font-medium text-foreground font-mono">
						{requestId}
					</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onCopyItem("requestId", requestId)}
					className="shrink-0"
				>
					<Copy className="h-4 w-4" />
				</Button>
			</div>
			<div className="flex items-start gap-3">
				<FileSignature className="h-5 w-5 text-muted-foreground mt-0.5" />
				<div className="flex-1">
					<p className="text-sm text-muted-foreground">Contract ID</p>
					<p className="text-base font-medium text-foreground font-mono">
						{contractId}
					</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onCopyItem("contractId", contractId)}
					className="shrink-0"
				>
					<Copy className="h-4 w-4" />
				</Button>
			</div>
		</>
	);
}
