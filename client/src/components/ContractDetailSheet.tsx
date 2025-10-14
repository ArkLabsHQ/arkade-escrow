import { useState } from "react";
import { Contract } from "@/types/escrow";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
	ArrowDownLeft,
	ArrowUpRight,
	User,
	Wallet,
	Copy,
	Banknote,
	FileText,
	AlertCircle,
	XCircle,
	CirclePause,
	ChevronDown,
	PauseCircle,
	BadgeInfoIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "./ui/separator";
import { toast } from "sonner";
import { ContractActionModal } from "./ContractActionModal";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./ui/collapsible";
import {
	ApiPaginatedEnvelope,
	GetEscrowContractDto,
	GetExecutionByContractDto,
} from "@/types/api";
import { Me } from "@/types/me";
import { shortKey } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Config from "@/Config";
import { useMessageBridge } from "@/components/MessageBus";

interface ContractDetailSheetProps {
	contract: GetEscrowContractDto | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onContractAction: (
		action: "accept" | "settle" | "approve" | "reject" | "recede" | "dispute",
		data: {
			contractId: string;
			executionId?: string;
			walletAddress: string | null;
			transaction: GetExecutionByContractDto["transaction"] | null;
			reason?: string;
		},
	) => void;
	me: Me;
}

export const ContractDetailSheet = ({
	contract,
	open,
	onOpenChange,
	onContractAction,
	me,
}: ContractDetailSheetProps) => {
	const { fundAddress, walletAddress, xPublicKey } = useMessageBridge();
	const [actionModalOpen, setActionModalOpen] = useState(false);
	const [currentAction, setCurrentAction] = useState<
		"accept" | "settle" | "approve" | "reject" | "recede" | "dispute"
	>("settle");

	const { data: dataExecutions, isError } = useQuery({
		queryKey: ["contract-executions", contract?.externalId],
		queryFn: async () => {
			const res = await axios.get<
				ApiPaginatedEnvelope<GetExecutionByContractDto>
			>(
				`${Config.apiBaseUrl}/escrows/contracts/${contract?.externalId}/executions`,
				{
					headers: { authorization: `Bearer ${me.getAccessToken()}` },
				},
			);
			return res.data;
		},
		enabled: !!contract?.externalId,
	});

	const { data: dataArbitrations } = useQuery({
		queryKey: ["contract-arbitrations", contract?.externalId],
		queryFn: async () => {
			const res = await axios.get<
				ApiPaginatedEnvelope<GetExecutionByContractDto>
			>(
				`${Config.apiBaseUrl}/escrows/arbitrations/?contract=${contract?.externalId}`,
				{
					headers: { authorization: `Bearer ${me.getAccessToken()}` },
				},
			);
			return res.data;
		},
		enabled: !!contract?.externalId,
	});

	if (isError) {
		console.error(isError);
		toast.error("Failed to load contract data");
	}

	if (!contract) return null;

	const fundedAmount =
		contract.virtualCoins?.reduce((acc, vc) => {
			console.log(vc);
			return vc.value + acc;
		}, 0) ?? 0;

	const formattedDate = format(contract.createdAt, "PPP 'at' p");
	const truncatedArkAddress = contract.arkAddress
		? `${contract.arkAddress.slice(0, 8)}...${contract.arkAddress.slice(-8)}`
		: undefined;
	const isFundingMet = fundedAmount ? fundedAmount >= contract.amount : false;
	const fundingDifference = fundedAmount ? fundedAmount - contract.amount : 0;

	const getCounterParty = () => {
		switch (contract.side) {
			case "receiver":
				if (me.isMyPubkey(contract.receiverPublicKey)) {
					return ["receiver", contract.senderPublicKey];
				}
				return ["sender", contract.receiverPublicKey];
			case "sender":
				if (me.isMyPubkey(contract.senderPublicKey)) {
					return ["sender", contract.receiverPublicKey];
				}
				return ["receiver", contract.senderPublicKey];
			default:
				return ["Unknown", "unknown"];
		}
	};

	const [yourSide, counterParty] = getCounterParty();
	const currentExecution = dataExecutions?.data.find((execution) =>
		execution.status.startsWith("pending-"),
	);
	const pastFailedExecutions =
		dataExecutions?.data.filter(
			(execution) =>
				!execution.status.startsWith("pending-") &&
				execution.status !== "executed",
		) ?? [];

	const handleCopyAddress = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!contract.arkAddress) return;
		navigator.clipboard.writeText(contract.arkAddress);
		toast.success("ARK address copied to clipboard");
	};

	const handleFundAddress = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!contract.arkAddress) return;
		fundAddress(contract.arkAddress, contract.amount);
	};

	const handleActionClick = (action: typeof currentAction) => {
		setCurrentAction(action);
		setActionModalOpen(true);
	};

	const handleActionConfirm = async (data?: { reason?: string }) => {
		const messages = {
			accept: "Contract accepted successfully",
			settle: "Settlement initiated successfully",
			approve: "Settlement approved successfully",
			reject: `Contract rejected ${data?.reason ? `: ${data.reason}` : ""}`,
			recede: `Receded from contract ${data?.reason ? `: ${data.reason}` : ""}`,
			dispute: `Dispute opened ${data?.reason ? `: ${data.reason}` : ""}`,
		};
		try {
			onContractAction(currentAction, {
				contractId: contract.externalId,
				walletAddress,
				executionId: currentExecution?.externalId,
				transaction: currentExecution?.transaction ?? null,
				reason: data?.reason,
			});
			// toast.success(messages[currentAction]);
			onOpenChange(false);
			setActionModalOpen(false);
		} catch (error) {
			console.error("Error handling action:", error);
			toast.error(`Failed to handle action ${currentAction}`, {
				description:
					error instanceof Error ? error.message : "An unknown error occurred",
			});
		}
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
			case "canceled-by-sender":
			case "canceled-by-receiver":
			case "canceled-by-arbiter":
			case "under-arbitration":
				return "bg-destructive/10 text-destructive border-destructive/20";
			default:
				return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
		}
	};

	const getStatusText = (status: GetEscrowContractDto["status"]) => {
		switch (status) {
			case "completed":
				return "Completed";
			case "funded":
				return "Virtual coins are present at this address";
			case "pending-execution": {
				if (!currentExecution) return "Pending execution";
				const isInitiator = me.isMyPubkey(currentExecution.initiatedByPubKey);
				if (isInitiator) {
					if (currentExecution.status === "pending-counterparty-signature")
						return "The counterparty has not signed the transaction yet";

					return "Waiting for your approval";
				}
				if (currentExecution.status === "pending-counterparty-signature")
					return "Waiting for your approval";
				return "The initator has not signed the transaction yet";
			}
			case "created":
				return "Created";
			case "draft":
				return "Draft";
			default:
				return status;
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-lg overflow-y-auto">
				<SheetHeader className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<SheetTitle className="text-2xl">Contract Details</SheetTitle>
							<p className="text-xs text-muted-foreground mt-1">
								{formattedDate}
							</p>
						</div>
						<div
							className={`rounded-lg p-2 ${
								contract.side === "receiver"
									? "bg-success/10 text-success"
									: "bg-primary/10 text-primary"
							}`}
						>
							{contract.side === "receiver" ? (
								<ArrowDownLeft className="h-6 w-6" />
							) : (
								<ArrowUpRight className="h-6 w-6" />
							)}
						</div>
					</div>
					<SheetDescription className="text-base">
						Review your contract details and transaction information
					</SheetDescription>
				</SheetHeader>

				<div className="mt-8 space-y-6">
					{/* Amount Section */}
					<div className="bg-gradient-shine rounded-xl p-6 border border-border">
						<div className="flex items-center justify-between">
							<div className="flex-1">
								<p className="text-sm text-muted-foreground mb-1">
									Requested Amount
								</p>
								<p className="text-3xl font-bold text-foreground">
									{contract.amount} SAT
								</p>

								{(contract.status === "funded" ||
									contract.status === "pending-execution" ||
									contract.status === "completed") &&
									fundedAmount && (
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
													{isFundingMet
														? "Requirement Met"
														: "Partially Funded"}
												</Badge>
											</div>
											<div className="flex items-baseline gap-2">
												<p className="text-2xl font-bold text-foreground">
													{fundedAmount} SAT
												</p>
												{fundingDifference !== 0 && (
													<p
														className={`text-sm ${fundingDifference > 0 ? "text-success" : "text-warning"}`}
													>
														{fundingDifference > 0 ? "+" : ""}
														{(fundingDifference / 100000000).toFixed(8)} SAT
													</p>
												)}
											</div>
										</div>
									)}
							</div>
							<Wallet className="h-12 w-12 text-primary opacity-50" />
						</div>
					</div>

					{/* Details Section */}
					<div className="space-y-4">
						<div className="flex items-start gap-3">
							<Badge
								className={getStatusColor(contract.status)}
								variant="outline"
							>
								{contract.status}
							</Badge>
							<div className="flex-1">
								<p className="text-sm text-muted-foreground">Status</p>
								<p className="text-base font-medium text-foreground">
									{getStatusText(contract.status)}
								</p>
							</div>
						</div>

						<Separator />

						<div className="flex items-start gap-3">
							<Badge
								variant={contract.side === "receiver" ? "default" : "secondary"}
								className="mt-1"
							>
								{contract.side}
							</Badge>
							<div className="flex-1">
								<p className="text-sm text-muted-foreground">Your Role</p>
								<p className="text-base font-medium text-foreground">
									You are the {yourSide} in this contract
								</p>
							</div>
						</div>

						<Separator />

						<div className="flex items-start gap-3">
							<User className="h-5 w-5 text-muted-foreground mt-0.5" />
							<div className="flex-1">
								<p className="text-sm text-muted-foreground">Counterparty</p>
								<p className="text-base font-medium text-foreground">
									{shortKey(counterParty)}
								</p>
							</div>
						</div>

						<Separator />

						<div className="flex items-start gap-3">
							<FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
							<div className="flex-1">
								<p className="text-sm text-muted-foreground">Request ID</p>
								<p className="text-base font-medium text-foreground font-mono">
									{contract.requestId}
								</p>
							</div>
						</div>
						<div className="flex items-start gap-3">
							<FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
							<div className="flex-1">
								<p className="text-sm text-muted-foreground">Contract ID</p>
								<p className="text-base font-medium text-foreground font-mono">
									{contract.externalId}
								</p>
							</div>
						</div>

						<Separator />

						<div>
							<p className="text-sm text-muted-foreground mb-2">Description</p>
							<p className="text-base text-foreground leading-relaxed">
								{contract.description}
							</p>
						</div>

						<Separator />

						<div>
							<p className="text-sm text-muted-foreground mb-2">ARK Address</p>
							<div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
								<p className="text-sm font-mono text-foreground flex-1 break-all">
									{truncatedArkAddress ||
										"The address will be generated once the contract is accepted"}
								</p>
								{contract.arkAddress && (
									<Button
										variant="ghost"
										size="sm"
										onClick={handleCopyAddress}
										className="shrink-0"
									>
										<Copy className="h-4 w-4" />
									</Button>
								)}
								{contract.arkAddress && (
									<Button
										variant="default"
										size="sm"
										onClick={handleFundAddress}
										className="shrink-0"
										disabled={!contract.arkAddress}
									>
										<Banknote className="h-4 w-4" />
									</Button>
								)}
							</div>
						</div>

						{/* Current Settlement - Collapsible */}
						{currentExecution && (
							<>
								<Separator />
								<Collapsible defaultOpen={true}>
									<CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:opacity-70 transition-opacity">
										<div className="flex items-center gap-2">
											<BadgeInfoIcon className="h-4 w-4 text-neutral" />
											<p className="text-sm font-medium text-foreground">
												Current Settlement Attempt
											</p>
										</div>
										<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 data-[state=open]:rotate-180" />
									</CollapsibleTrigger>
									<CollapsibleContent className="space-y-3 pt-3 animate-accordion-down">
										<div
											key={currentExecution.externalId}
											className="bg-neutral/5 border border-neutral/20 rounded-lg p-3 space-y-2 animate-fade-in"
										>
											<div className="flex items-start gap-2">
												<CirclePause className="h-4 w-4 text-neutral mt-0.5 shrink-0" />
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 flex-wrap">
														<Badge
															variant="outline"
															className="bg-neutral/10 text-neutral border-neutral/20"
														>
															{currentExecution.status}
														</Badge>
														<span className="text-xs text-muted-foreground">
															{format(currentExecution.createdAt, "PPp")}
														</span>
													</div>
													<p className="text-sm text-foreground mt-1">
														Initiated by{" "}
														<span className="font-medium">
															{me.pubkeyAsMe(
																currentExecution.initiatedByPubKey,
															)}
														</span>
													</p>
													{currentExecution.cancelationReason && (
														<p className="text-xs text-muted-foreground mt-1 italic">
															"{currentExecution.cancelationReason}"
														</p>
													)}
													{currentExecution.rejectionReason && (
														<p className="text-xs text-muted-foreground mt-1 italic">
															"{currentExecution.rejectionReason}"
														</p>
													)}
												</div>
											</div>
										</div>
									</CollapsibleContent>
								</Collapsible>
							</>
						)}

						{/* Past Settlements - Collapsible */}
						{pastFailedExecutions.length > 0 && (
							<>
								<Separator />
								<Collapsible>
									<CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:opacity-70 transition-opacity">
										<div className="flex items-center gap-2">
											<AlertCircle className="h-4 w-4 text-destructive" />
											<p className="text-sm font-medium text-foreground">
												Past Settlement Attempts ({pastFailedExecutions.length})
											</p>
										</div>
										<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 data-[state=open]:rotate-180" />
									</CollapsibleTrigger>
									<CollapsibleContent className="space-y-3 pt-3 animate-accordion-down">
										{pastFailedExecutions.map((settlement) => (
											<div
												key={settlement.externalId}
												className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2 animate-fade-in"
											>
												<div className="flex items-start gap-2">
													<XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 flex-wrap">
															<Badge
																variant="outline"
																className="bg-destructive/10 text-destructive border-destructive/20"
															>
																{settlement.status}
															</Badge>
															<span className="text-xs text-muted-foreground">
																{format(settlement.createdAt, "PPp")}
															</span>
														</div>
														<p className="text-sm text-foreground mt-1">
															Initiated by{" "}
															<span className="font-medium">
																{shortKey(settlement.initiatedByPubKey)}
															</span>
														</p>
														{settlement.cancelationReason && (
															<p className="text-xs text-muted-foreground mt-1 italic">
																"{settlement.cancelationReason}"
															</p>
														)}
														{settlement.rejectionReason && (
															<p className="text-xs text-muted-foreground mt-1 italic">
																"{settlement.rejectionReason}"
															</p>
														)}
													</div>
												</div>
											</div>
										))}
									</CollapsibleContent>
								</Collapsible>
							</>
						)}
					</div>

					{/* Actions */}
					<div className="space-y-3 pt-4">
						{/* Draft status: Accept */}
						{contract.status === "draft" && (
							<Button
								className="w-full"
								onClick={() => handleActionClick("accept")}
							>
								Accept Contract
							</Button>
						)}

						{/* Draft status: Reject */}
						{contract.status === "draft" && (
							<Button
								variant="destructive"
								className="w-full"
								onClick={() => handleActionClick("reject")}
							>
								Reject Contract
							</Button>
						)}

						{/* Created status: Recede */}
						{contract.status === "created" && (
							<Button
								variant="outline"
								className="w-full"
								onClick={() => handleActionClick("recede")}
							>
								Recede from Contract
							</Button>
						)}

						{/* Funded: Settle */}
						{contract.status === "funded" && (
							<Button
								className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
								onClick={() => handleActionClick("settle")}
							>
								{"Settle Contract"}
							</Button>
						)}

						{/* Pending-execution and missing signer: Approve + Dispute */}
						{contract.status === "pending-execution" &&
							!currentExecution?.transaction.approvedByPubKeys.includes(
								xPublicKey ?? "",
							) && (
								<Button
									className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
									onClick={() => handleActionClick("approve")}
								>
									{"Approve Settlement"}
								</Button>
							)}

						{/* Funded or Pending-execution: Dispute */}
						{(contract.status === "funded" ||
							contract.status === "pending-execution") && (
							<Button
								variant="destructive"
								className="w-full"
								onClick={() => handleActionClick("dispute")}
							>
								Open Dispute
							</Button>
						)}

						{/* Close button - always visible */}
						<Button
							variant="ghost"
							className="w-full"
							onClick={() => onOpenChange(false)}
						>
							Close
						</Button>
					</div>
				</div>
			</SheetContent>

			<ContractActionModal
				open={actionModalOpen}
				onOpenChange={setActionModalOpen}
				actionType={currentAction}
				onConfirm={handleActionConfirm}
			/>
		</Sheet>
	);
};
