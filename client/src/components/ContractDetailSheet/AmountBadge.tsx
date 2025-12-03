import { Badge } from "@/components/ui/badge";
import { Bitcoin, Wallet } from "lucide-react";

export function AmountBadge({
	required,
	funded,
}: {
	required: number;
	funded: number;
}) {
	const fundingDifference = funded - required;
	const isFundingMet = fundingDifference >= 0;
	return (
		<div className="bg-gradient-shine rounded-xl p-6 border border-border">
			<div className="flex items-center justify-between">
				<div className="flex-1">
					<p className="text-sm text-muted-foreground mb-1">Requested Amount</p>
					<p className="text-3xl font-bold text-foreground">{required} SAT</p>

					{funded > 0 ? (
						<div className="mt-4 pt-4 border-t border-border/50">
							<div className="flex items-center gap-2 mb-1">
								<p className="text-sm text-muted-foreground">
									Currently Funded
								</p>
								<Badge
									className={
										isFundingMet
											? "bg-success/10 text-success border-success/20"
											: "bg-warning/10 text-warning border-warning/20"
									}
									variant="outline"
								>
									{isFundingMet ? "Requirement Met" : "Partially Funded"}
								</Badge>
							</div>
							<div className="flex items-baseline gap-2">
								<p className="text-2xl font-bold text-foreground">
									{funded} SAT
								</p>
								{fundingDifference > 0 && (
									<p
										className={`text-sm ${fundingDifference > 0 ? "text-success" : "text-warning"}`}
									>
										{`${fundingDifference > 0 ? "+" : ""}${fundingDifference} SAT`}
									</p>
								)}
							</div>
						</div>
					) : null}
				</div>
				<Bitcoin className="h-12 w-12 text-primary opacity-50" />
			</div>
		</div>
	);
}
