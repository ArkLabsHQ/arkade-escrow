import { AlertCircle, Copy, FileSignature, XCircle } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { GetExecutionByContractDto } from "@/types/api";
import { Me } from "@/types/me";
import { shortKey } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

type Props = {
	me: Me;
	executions: GetExecutionByContractDto[];
	onRejectExecution: (executionId: string) => void;
	onSignExecution: (
		executionId: string,
		transaction: GetExecutionByContractDto["transaction"],
	) => void;
};

export default function PendingExecutions({
	me,
	executions,
	onRejectExecution,
	onSignExecution,
}: Props) {
	if (executions.length === 0) return null;

	const handleCopyTxData =
		(tx: GetExecutionByContractDto["transaction"]) => () => {
			navigator.clipboard.writeText(
				JSON.stringify(
					{ tx: tx.arkTx, checkpoints: tx.checkpoints },
					undefined,
					4,
				),
			);
			// toast.success("Transaction data copied to clipboard");
		};

	const handleSignExecution = (execution: GetExecutionByContractDto) => () => {
		onSignExecution(execution.externalId, execution.transaction);
	};

	const handleRejectExecution =
		(execution: GetExecutionByContractDto) => () => {
			onRejectExecution(execution.externalId);
		};

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<AlertCircle className="h-5 w-5 text-warning" />
				<p className="text-base font-semibold text-foreground">
					Pending Executions Attempts ({executions.length})
				</p>
			</div>

			<Accordion type="single" collapsible className="space-y-2">
				{executions.map((execution, index) => {
					const signedByMe = execution.transaction.approvedByPubKeys.some((_) =>
						me.isMyPubkey(_),
					);

					const description = signedByMe
						? `Initiated by ${me.pubkeyAsMe(execution.initiatedByPubKey)}, waiting for counterparty's signature`
						: `Initiated by ${me.pubkeyAsMe(execution.initiatedByPubKey)}, waiting for your signature`;

					return (
						<AccordionItem
							key={execution.externalId}
							value={`item-${index}`}
							className="bg-warning/5 border border-warning/20 rounded-lg overflow-hidden"
						>
							<AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-warning/10 transition-colors">
								<div className="flex items-center gap-2 text-left">
									<span className="text-sm font-medium text-foreground">
										Attempt #{index + 1}
									</span>

									<span className="text-xs text-muted-foreground">
										{format(execution.createdAt, "PPp")}
									</span>
								</div>
							</AccordionTrigger>

							<AccordionContent className="px-4 pb-4 pt-0">
								<div className="space-y-4">
									<p className="text-sm text-foreground">{description}</p>

									{execution.cancelationReason && (
										<p className="text-xs text-muted-foreground italic">
											"{execution.cancelationReason}"
										</p>
									)}
									{execution.rejectionReason && (
										<p className="text-xs text-muted-foreground italic">
											"{execution.rejectionReason}"
										</p>
									)}

									<div className="flex flex-col gap-2">
										<div className="flex gap-2">
											<Button
												disabled={signedByMe}
												size="sm"
												className="flex-1 min-w-0 bg-gradient-primary hover:opacity-90"
												onClick={handleSignExecution(execution)}
											>
												<FileSignature className="h-4 w-4 shrink-0" />
												<span className="truncate">
													{signedByMe ? "Already Signed" : "Sign Execution"}
												</span>
											</Button>

											<Button
												size="sm"
												variant="destructive"
												className="flex-1 min-w-0"
												onClick={handleRejectExecution(execution)}
											>
												<XCircle className="h-4 w-4 shrink-0" />
												<span className="truncate">Reject Execution</span>
											</Button>
										</div>

										<Button
											size="sm"
											variant="outline"
											className="w-full"
											onClick={handleCopyTxData(execution.transaction)}
										>
											<Copy className="h-4 w-4 mr-2" />
											Copy TX (JSON)
										</Button>
									</div>
								</div>
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>
		</div>
	);
}
