import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
    ArrowDownLeft,
    ArrowUpRight,
    Wallet,
    Copy,
    Banknote,
    AlertCircle,
    ChevronDown,
    BadgeInfoIcon,
    BookOpen,
    Book,
    ChevronUp,
    Hourglass, PencilLine,
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
import { getContractSideDetails, shortArkAddress } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Config from "@/Config";
import ContractActions, {
	ContractAction,
} from "@/components/ContractDetailSheet/ContractActions";
import ExecutionAttempt from "@/components/ContractDetailSheet/ExecutionAttempt";
import ArbitrationSection from "@/components/ContractDetailSheet/ArbitrationSection";
import { useContractSse } from "@/components/ContractDetailSheet/useContractSse";
import { Skeleton } from "../ui/skeleton";
import { ApiEnvelopeShellDto } from "../../../../server/src/common/dto/envelopes";
import { AmountBadge } from "@/components/ContractDetailSheet/AmountBadge";
import { AdditionalData } from "@/components/ContractDetailSheet/AdditionalData";
import { StatusText } from "@/components/ContractDetailSheet/StatusText";
import { RowIcon } from "@/components/ContractDetailSheet/RowIcon";
import { ActionInput } from "@/components/ContractDetailSheet/useContractActionHandler";

type ContractDetailSheetProps = {
	contract: GetEscrowContractDto | null;
	open: boolean;
	runAction?: ContractAction;
	balance?: number;
	onOpenChange: (open: boolean) => void;
	onContractAction: (data: ActionInput) => void;
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
	onContractAction: (data: ActionInput) => void;
	runAction?: ContractAction;
	me: Me;
};

const InnerContractDetailSheet = ({
	contract: inputContract,
	balance,
	onOpenChange,
	onContractAction,
	runAction,
	me,
}: InnerContractDetailSheetProps) => {
	const [actionModalOpen, setActionModalOpen] = useState(false);
	const [showBalanceWarning, setShowBalanceWarning] = useState(false);
	const [isAdditionaDataOpen, setIsAdditionalDataOpen] = useState(false);
	const [isFunding, setIsFunding] = useState(false);
	const [currentAction, setCurrentAction] = useState<
		ContractAction | undefined
	>();
	const lastContractEvent = useContractSse(inputContract.externalId);

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

	const { mySide, counterParty, createdByMe } = getContractSideDetails(
		me,
		contract,
	);

	useEffect(() => {
		if (
			contract?.status === "created" &&
			balance !== undefined &&
			createdByMe
		) {
			if (balance < contract.amount) {
				if (!showBalanceWarning) {
					setShowBalanceWarning(true);
				}
			} else if (showBalanceWarning) {
				setShowBalanceWarning(false);
			}
		}
	}, [contract, balance, showBalanceWarning, createdByMe]);

	const canFund =
		!!contract.arkAddress &&
		mySide === "sender" &&
		(contract.status === "created" || contract.status === "funded");

	const fundedAmount =
		contract.virtualCoins?.reduce((acc, vc) => vc.value + acc, 0) ?? 0;

	const formattedDate = format(contract.createdAt, "PPP 'at' p");

	const currentExecution = dataExecutions?.data.find((execution) =>
		execution.status.startsWith("pending-"),
	);
	const pastFailedExecutions =
		dataExecutions?.data.filter(
			(execution) =>
				!execution.status.startsWith("pending-") &&
				execution.status !== "executed",
		) ?? [];

	const handleCopyContractId =  async (e: React.MouseEvent) => {
        e.stopPropagation();
		navigator.clipboard.writeText(contract.externalId);
		toast.success("Contract ID copied to clipboard");
	};

    const canUpdateReleaseAddress = mySide === "receiver" && ["draft","created","pending-execution","under-arbitration"].includes(contract.status)
    const handleUpdateReleaseAddress = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canUpdateReleaseAddress) return;
        handleActionClick("update-release-address");

    }

	const handleCopyItem = (_: string, value: string) => {
		// it's a Promise to allow for feedback animation
		try {
			navigator.clipboard.writeText(value);
			return Promise.resolve();
		} catch (error) {
			console.error("Failed to access clipboard:", error);
			return Promise.reject(error);
		}
	};

	const handleFundAddress = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!contract.arkAddress) return;
		handleActionClick("fund-contract");
	};

	const handleActionClick = (action: ContractAction) => {
		setCurrentAction(action);
		setActionModalOpen(true);
	};

	const handleActionConfirm = async (data?: { reason?: string, releaseAddress?: string, disputeReason?: string }) => {
		if (!currentAction) {
			console.warn("No current action selected");
			return;
		}
		try {
			onContractAction({
				action: currentAction,
				contractId: contract.externalId,
				contractAmount: contract.amount,
				contractArkAddress: contract.arkAddress,
				executionId: currentExecution?.externalId,
				disputeId: currentArbitration?.externalId,
				transaction: currentExecution?.transaction ?? null,
				reason: data?.reason ?? data?.disputeReason,
                newReleaseAddress: data?.releaseAddress,
				receiverAddress: contract.receiverAddress,
			});
		} catch (error) {
			console.error("Error handling action:", error);
			toast.error(`Failed to handle action ${currentAction}`, {
				description:
					error instanceof Error ? error.message : "An unknown error occurred",
			});
		} finally {
			if (runAction) {
				onOpenChange(false);
			}
			setActionModalOpen(false);
		}
	};

	useEffect(() => {
		if (runAction) {
			handleActionClick(runAction);
		}
	}, [runAction]);

	return (
		<>
			<SheetHeader className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex-1">
						<SheetTitle className="text-2xl">
							Contract <code className="text-base">{contract.externalId}</code>
						</SheetTitle>
						<p className="text-xs text-muted-foreground mt-1">
							{formattedDate}
						</p>
					</div>
				</div>
			</SheetHeader>

			<div className="mt-8 space-y-6">
				<AmountBadge required={contract.amount} funded={fundedAmount} />

				{/* Details Section */}
				<div className="space-y-4">
					<div className="flex items-start gap-3">
						<div
							className={`rounded-lg p-2 ${
								mySide === "receiver"
									? "bg-success/10 text-success"
									: "bg-primary/10 text-primary"
							}`}
						>
							{mySide === "receiver" ? (
								<ArrowDownLeft className="h-4 w-4" />
							) : (
								<ArrowUpRight className="h-4 w-4" />
							)}
						</div>
						<div className="flex-1">
							<p className="text-base font-medium text-foreground">
								You are the {mySide} in this contract
							</p>
						</div>
					</div>

					<Separator />

					<StatusText
						me={me}
						sideDetails={{ mySide, createdByMe }}
						status={contract.status}
						currentExecution={currentExecution}
					/>

					{/* Arbitration Section */}
					{contract.status === "under-arbitration" && currentArbitration && (
						<div className="space-y-3">
							<ArbitrationSection arbitration={currentArbitration} me={me} />
						</div>
					)}

					{mySide === "receiver" ? (
						<div className="flex items-start gap-3">
							<RowIcon>
								<Wallet className="text-accent" />
							</RowIcon>
							<div className="flex-1">
								<p className="text-sm text-muted-foreground">Release address</p>
								<p className="text-base font-medium text-foreground font-mono">
									{contract.receiverAddress
										? shortArkAddress(contract.receiverAddress)
										: "Not set yet"}
								</p>
							</div>
							<RowIcon>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleCopyContractId}
									className="shrink-0"
								>
									<Copy className="h-4 w-4" />
								</Button>
							</RowIcon>
                            <RowIcon>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleUpdateReleaseAddress}
                                    className="shrink-0"
                                >
                                    <PencilLine className="h-4 w-4" />
                                </Button>
                            </RowIcon>
						</div>
					) : null}

					<Separator />

					<Collapsible
						defaultOpen={false}
						onOpenChange={(o) => setIsAdditionalDataOpen(o)}
					>
						<CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:opacity-70 transition-opacity">
							<div className="flex items-center gap-3">
								{isAdditionaDataOpen ? (
									<span className="flex w-8 h-8">
										<BookOpen className="h-8 w-8 text-muted-foreground" />
									</span>
								) : (
									<span className="flex w-8 h-8 justify-center items-center">
										<Book className="h-8 w-8 text-muted-foreground" />
									</span>
								)}
								<p className="text-sm font-medium text-foreground">
									Additional information
								</p>
							</div>
							{isAdditionaDataOpen ? (
								<span className="flex w-8 h-8 justify-center items-center">
									<ChevronUp className="h-4 w-4 text-muted-foreground transition-transform duration-300 data-[state=open]:rotate-180" />
								</span>
							) : (
								<span className="flex w-8 h-8 justify-center items-center">
									<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 data-[state=open]:rotate-180" />
								</span>
							)}
						</CollapsibleTrigger>
						<CollapsibleContent className="space-y-3 pt-3 animate-accordion-down">
							<AdditionalData
								createdByMe={createdByMe}
								counterParty={counterParty}
								contractId={contract.externalId}
								requestId={contract.requestId}
								description={contract.description}
								onCopyItem={handleCopyItem}
							/>
						</CollapsibleContent>
					</Collapsible>

					<Separator />

					{contract.status !== "completed" && contract.status !== "draft" && (
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
									{contract.arkAddress
										? shortArkAddress(contract.arkAddress)
										: "The address will be generated once the contract is accepted"}
								</p>
								{contract.arkAddress && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											handleCopyItem(
												"contractAddress",
												contract.arkAddress ?? "",
											)
										}
										className="shrink-0"
									>
										<Copy className="h-4 w-4" />
									</Button>
								)}
								{canFund && (
									<Button
										variant="default"
										size="sm"
										onClick={handleFundAddress}
										className="shrink-0"
										disabled={!contract.arkAddress || isFunding}
									>
										{isFunding ? (
											<Hourglass className="h-4 w-4" />
										) : (
											<Banknote className="h-4 w-4" />
										)}
									</Button>
								)}
							</div>
						</div>
					)}

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
					data={{ amount: contract.amount }}
					onConfirm={handleActionConfirm}
				/>
			)}
		</>
	);
};
