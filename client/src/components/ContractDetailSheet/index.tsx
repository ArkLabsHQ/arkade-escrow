import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
	ArrowDownLeft,
	ArrowUpRight,
	User,
	Wallet,
	Copy,
	Banknote,
	FileText,
	AlertCircle,
	ChevronDown,
	BadgeInfoIcon,
	FileSignature,
	Scale,
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "../ui/separator";
import { toast } from "sonner";
import { ContractActionModal } from "../ContractActionModal";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../ui/collapsible";
import {
	ApiPaginatedEnvelope,
	GetArbitrationDto,
	GetEscrowContractDto,
	GetExecutionByContractDto,
} from "@/types/api";
import { Me } from "@/types/me";
import { getContractSideDetails, shortKey } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Config from "@/Config";
import { useMessageBridge } from "@/components/MessageBus";
import ContractActions, {
	ContractAction,
} from "@/components/ContractDetailSheet/ContractActions";
import { getStatusText } from "@/components/ContractDetailSheet/helpers";
import ExecutionAttempt from "@/components/ContractDetailSheet/ExecutionAttempt";
import ArbitrationSection from "@/components/ContractDetailSheet/ArbitrationSection";
import { useContractSse } from "@/components/ContractDetailSheet/useContractSse";
import { Skeleton } from "../ui/skeleton";
import { ApiEnvelopeShellDto } from "../../../../server/src/common/dto/envelopes";

type ContractDetailSheetProps = {
	contract: GetEscrowContractDto | null;
	open: boolean;
	balance?: number;
	onOpenChange: (open: boolean) => void;
	onContractAction: (
		action: ContractAction,
		data: {
			contractId: string;
			executionId?: string;
			disputeId?: string;
			walletAddress: string | null;
			transaction: GetExecutionByContractDto["transaction"] | null;
			reason?: string;
		},
	) => void;
	me: Me;
};

export const ContractDetailSheet = (props: ContractDetailSheetProps) => {
	return (
		<Sheet open={props.open} onOpenChange={props.onOpenChange}>
			<SheetContent className="w-full sm:max-w-lg overflow-y-auto">
				{props.contract === null ? (
					<>
						<SheetHeader className="space-y-3">
							<div>
								<Skeleton className="h-8 w-48 mb-2" />
								<Skeleton className="h-3 w-32" />
							</div>
						</SheetHeader>
						<div className="mt-8 space-y-6">
							{/* Amount Section Skeleton */}
							<div className="bg-gradient-shine rounded-xl p-6 border border-border">
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<Skeleton className="h-4 w-32 mb-2" />

										<Skeleton className="h-9 w-48" />
									</div>

									<Skeleton className="h-12 w-12 rounded-lg" />
								</div>
							</div>
							{/* Details Section Skeletons */}
							<div className="space-y-4">
								{/* Status */}
								<div className="flex items-start gap-3">
									<Skeleton className="h-6 w-20 rounded-full" />

									<div className="flex-1">
										<Skeleton className="h-4 w-16 mb-2" />

										<Skeleton className="h-5 w-32" />
									</div>
								</div>
								<Separator />
								{/* Role */}
								<div className="flex items-start gap-3">
									<Skeleton className="h-9 w-9 rounded-lg" />

									<div className="flex-1">
										<Skeleton className="h-4 w-20 mb-2" />

										<Skeleton className="h-5 w-48" />
									</div>
								</div>
							</div>
						</div>
					</>
				) : (
					<InnerContractDetailSheet {...props} contract={props.contract} />
				)}
			</SheetContent>
		</Sheet>
	);
};

type InnerContractDetailSheetProps = {
	contract: GetEscrowContractDto;
	balance?: number;
	onOpenChange: (open: boolean) => void;
	onContractAction: (
		action: ContractAction,
		data: {
			contractId: string;
			executionId?: string;
			disputeId?: string;
			walletAddress: string | null;
			transaction: GetExecutionByContractDto["transaction"] | null;
			reason?: string;
		},
	) => void;
	me: Me;
};

const InnerContractDetailSheet = ({
	contract: inputContract,
	balance,
	onOpenChange,
	onContractAction,
	me,
}: InnerContractDetailSheetProps) => {
	const { fundAddress, walletAddress } = useMessageBridge();
	const [actionModalOpen, setActionModalOpen] = useState(false);
	const [showBalanceWarning, setShowBalanceWarning] = useState(false);
	const [currentAction, setCurrentAction] = useState<
		ContractAction | undefined
	>();
	const lastContractEvent = useContractSse(inputContract.externalId, (_) => {
		console.log("New contract event received");
	});

	const { data: latestContract, error: latestContractError } = useQuery({
		queryKey: ["contract", inputContract.externalId, lastContractEvent],
		queryFn: async () => {
			const res = await axios.get<ApiEnvelopeShellDto<GetEscrowContractDto>>(
				`${Config.apiBaseUrl}/escrows/contracts/${inputContract.externalId}`,
				{
					headers: { authorization: `Bearer ${me.getAccessToken()}` },
				},
			);
			return res.data.data;
		},
	});

	const contract = latestContract ?? inputContract;

	const { data: dataExecutions, error: dataExecutionsError } = useQuery({
		queryKey: ["contract-executions", contract.externalId, lastContractEvent],
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
	});

	const { data: dataArbitrations, error: dataArbitrationsError } = useQuery({
		queryKey: ["contract-arbitrations", contract.externalId, lastContractEvent],
		queryFn: async () => {
			const res = await axios.get<ApiPaginatedEnvelope<GetArbitrationDto>>(
				`${Config.apiBaseUrl}/escrows/arbitrations/?contract=${contract?.externalId}`,
				{
					headers: { authorization: `Bearer ${me.getAccessToken()}` },
				},
			);
			return res.data;
		},
	});

	// Only one arbitration is supported for now
	const currentArbitration = dataArbitrations?.data[0];

	if (dataExecutionsError || dataArbitrationsError || latestContractError) {
		const error =
			dataExecutionsError ?? dataArbitrationsError ?? latestContractError;
		console.error(error);
		toast.error("Failed to load contract data");
	}

	useEffect(() => {
		if (contract?.status === "created" && balance !== undefined) {
			if (balance < contract.amount) {
				if (!showBalanceWarning) {
					setShowBalanceWarning(true);
				}
			} else if (showBalanceWarning) {
				setShowBalanceWarning(false);
			}
		}
	}, [contract, balance, showBalanceWarning]);

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

	const { mySide, counterParty, createdByMe } = getContractSideDetails(
		me,
		contract,
	);
	const currentExecution = dataExecutions?.data.find((execution) =>
		execution.status.startsWith("pending-"),
	);
	const pastFailedExecutions =
		dataExecutions?.data.filter(
			(execution) =>
				!execution.status.startsWith("pending-") &&
				execution.status !== "executed",
		) ?? [];

	const handleCopyContractId = () => {
		navigator.clipboard.writeText(contract.externalId);
		toast.success("Contract ID copied to clipboard");
	};
	const handleCopyRequestId = () => {
		navigator.clipboard.writeText(contract.requestId);
		toast.success("Request ID copied to clipboard");
	};
	const handleCopyCounterparty = () => {
		navigator.clipboard.writeText(counterParty);
		toast.success("Counterparty copied to clipboard");
	};

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

	const handleActionClick = (action: ContractAction) => {
		setCurrentAction(action);
		setActionModalOpen(true);
	};

	const handleActionConfirm = async (data?: { reason?: string }) => {
		if (!currentAction) {
			console.warn("No current action selected");
			return;
		}
		try {
			onContractAction(currentAction, {
				contractId: contract.externalId,
				walletAddress,
				executionId: currentExecution?.externalId,
				disputeId: currentArbitration?.externalId,
				transaction: currentExecution?.transaction ?? null,
				reason: data?.reason,
			});
		} catch (error) {
			console.error("Error handling action:", error);
			toast.error(`Failed to handle action ${currentAction}`, {
				description:
					error instanceof Error ? error.message : "An unknown error occurred",
			});
		}
	};

	return (
		<>
			<SheetHeader className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex-1">
						<SheetTitle className="text-2xl">Contract Details</SheetTitle>
						<p className="text-xs text-muted-foreground mt-1">
							{formattedDate}
						</p>
					</div>
				</div>
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
												{isFundingMet ? "Requirement Met" : "Partially Funded"}
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
													{`${fundingDifference > 0 ? "+" : ""}${fundingDifference} SAT`}
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
						<div className="flex-1">
							<p className="text-sm text-muted-foreground">Status</p>
							<p className="text-base font-medium text-foreground">
								{getStatusText(me, { mySide, createdByMe }, contract.status)}
							</p>
						</div>
					</div>

					<Separator />

					<div className="flex items-start gap-3">
						<div
							className={`rounded-lg p-2 ${
								mySide === "receiver"
									? "bg-success/10 text-success"
									: "bg-primary/10 text-primary"
							}`}
						>
							{mySide === "receiver" ? (
								<ArrowDownLeft className="h-5 w-5" />
							) : (
								<ArrowUpRight className="h-5 w-5" />
							)}
						</div>
						<div className="flex-1">
							<p className="text-sm text-muted-foreground">Your Role</p>
							<p className="text-base font-medium text-foreground">
								You are the {mySide} in this contract
							</p>
						</div>
					</div>

					<Separator />

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
							onClick={handleCopyCounterparty}
							className="shrink-0"
						>
							<Copy className="h-4 w-4" />
						</Button>
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
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCopyRequestId}
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
								{contract.externalId}
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCopyContractId}
							className="shrink-0"
						>
							<Copy className="h-4 w-4" />
						</Button>
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
						<div className="flex items-center justify-between mb-2">
							<p className="text-sm text-muted-foreground">ARK Address</p>
							{showBalanceWarning && balance !== null && (
								<Badge
									variant="outline"
									className="bg-warning/10 text-warning border-warning/20 text-xs"
								>
									{`Your available balance is only ${balance} SAT`}
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
							<p className="text-sm font-mono text-foreground flex-1 break-normal">
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
							{contract.arkAddress && mySide === "sender" && (
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

					{/* Current Execution - Collapsible */}
					{currentExecution && (
						<>
							<Separator />
							<Collapsible defaultOpen={true}>
								<CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:opacity-70 transition-opacity">
									<div className="flex items-center gap-2">
										<BadgeInfoIcon className="h-4 w-4 text-neutral" />
										<p className="text-sm font-medium text-foreground">
											Current Execution Attempt
										</p>
									</div>
									<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 data-[state=open]:rotate-180" />
								</CollapsibleTrigger>
								<CollapsibleContent className="space-y-3 pt-3 animate-accordion-down">
									<ExecutionAttempt execution={currentExecution} me={me} />
								</CollapsibleContent>
							</Collapsible>
						</>
					)}

					{/* Arbitration Section - Non-collapsible */}
					{contract.status === "under-arbitration" && currentArbitration && (
						<>
							<Separator />

							<div className="space-y-3">
								<div className="flex items-center gap-2">
									<Scale className="h-5 w-5 text-destructive" />

									<p className="text-base font-semibold text-foreground">
										Arbitration
									</p>
								</div>
								<ArbitrationSection arbitration={currentArbitration} me={me} />
							</div>
						</>
					)}

					{/* Past Executions - Collapsible */}
					{pastFailedExecutions.length > 0 && (
						<>
							<Separator />
							<Collapsible>
								<CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:opacity-70 transition-opacity">
									<div className="flex items-center gap-2">
										<AlertCircle className="h-4 w-4 text-destructive" />
										<p className="text-sm font-medium text-foreground">
											Past Execution Attempts ({pastFailedExecutions.length})
										</p>
									</div>
									<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 data-[state=open]:rotate-180" />
								</CollapsibleTrigger>
								<CollapsibleContent className="space-y-3 pt-3 animate-accordion-down">
									{pastFailedExecutions.map((execution) => (
										<ExecutionAttempt
											key={execution.externalId}
											execution={execution}
											me={me}
											isPast
										/>
									))}
								</CollapsibleContent>
							</Collapsible>
						</>
					)}
				</div>

				{/* Actions */}
				<div className="space-y-3 pt-4">
					<ContractActions
						me={me}
						contractStatus={contract.status}
						sideDetails={getContractSideDetails(me, contract)}
						currentExecution={currentExecution}
						currentArbitration={currentArbitration}
						onClick={handleActionClick}
					/>
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

			{currentAction && (
				<ContractActionModal
					open={actionModalOpen}
					onOpenChange={setActionModalOpen}
					actionType={currentAction}
					onConfirm={handleActionConfirm}
				/>
			)}
		</>
	);
};
