import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ArrowDownLeft, ArrowUpRight, User, Wallet } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "./ui/separator";
import { GetEscrowContractDto, GetEscrowRequestDto } from "@/types/api";
import { Me } from "@/types/me";
import { Link } from "react-router-dom";
import Config from "@/Config";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { ContractCreationWizard } from "@/components/ContractCreationWizard";
import { toast } from "sonner";

interface RequestDetailSheetProps {
	me: Me;
	walletAddress: string | null;
	request: GetEscrowRequestDto | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onContractCreated?: (contract: GetEscrowContractDto) => void;
}

export const RequestDetailSheet = ({
	me,
	walletAddress,
	request,
	open,
	onOpenChange,
	onContractCreated,
}: RequestDetailSheetProps) => {
	const [wizardOpen, setWizardOpen] = useState(false);

	const cancelRequest = useMutation({
		mutationFn: async (input: { requestId: string }) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const res = await axios.patch<GetEscrowRequestDto>(
				`${Config.apiBaseUrl}/escrows/requests/${input.requestId}/cancel`,
				{},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			return res.data;
		},
	});

	const createContractFromRequest = useMutation({
		mutationFn: async (payload: {
			requestId: string;
			receiverAddress?: string;
		}): Promise<GetEscrowContractDto> => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const res = await axios.post(
				`${Config.apiBaseUrl}/escrows/contracts`,
				payload,
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			return res.data.data;
		},
	});

	const handleCreateContract = (
		requestId: string,
		receiverAddress?: string,
	) => {
		createContractFromRequest.mutate(
			{ requestId, receiverAddress },
			{
				onSuccess: (resp) => {
					toast.success("Contract created successfully!", {
						description: "You can now view and manage your contract.",
					});
					if (onContractCreated) onContractCreated(resp);
				},
				onError: (error) => {
					toast.error("Failed to create contract", {
						description: error.message,
					});
				},
			},
		);
		onOpenChange(false);
	};

	if (!request) return null;

	const formattedDate = format(request.createdAt, "PPP 'at' p");
	const isMine = me.isMyPubkey(request.creatorPublicKey);
	const myRole = isMine
		? request.side
		: request.side === "receiver"
			? "sender"
			: "receiver";

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-lg overflow-y-auto">
				<SheetHeader className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<SheetTitle className="text-2xl">Request Details</SheetTitle>
							<p className="text-xs text-muted-foreground mt-1">
								{formattedDate}
							</p>
						</div>
					</div>
					<SheetDescription className="text-base">
						{isMine
							? "You created this request."
							: "You can create a contract for this request."}
					</SheetDescription>
				</SheetHeader>

				<div className="mt-8 space-y-6">
					{/* Amount Section */}
					<div className="bg-gradient-shine rounded-xl p-6 border border-border">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground mb-1">Amount</p>
								<p className="text-4xl font-bold text-foreground">
									{request.amount}
								</p>
								<p className="text-sm text-muted-foreground mt-1">SAT</p>
							</div>
							<Wallet className="h-12 w-12 text-primary opacity-50" />
						</div>
					</div>

					{/* Details Section */}
					<div className="space-y-4">
						<div className="flex items-start gap-3">
							<div
								className={`rounded-lg p-2 ${
									myRole === "receiver"
										? "bg-success/10 text-success"
										: "bg-primary/10 text-primary"
								}`}
							>
								{myRole === "receiver" ? (
									<ArrowDownLeft className="h-5 w-5" />
								) : (
									<ArrowUpRight className="h-5 w-5" />
								)}
							</div>
							<div className="flex-1">
								<p className="text-sm text-muted-foreground">Your Role</p>
								<p className="text-base font-medium text-foreground">
									You will be the {myRole} in this escrow
								</p>
							</div>
						</div>

						<Separator />

						<div className="flex items-start gap-3">
							<User className="h-5 w-5 text-muted-foreground mt-0.5" />
							<div className="flex-1">
								<p className="text-sm text-muted-foreground">Created by</p>
								<p className="text-base font-medium text-foreground">
									{me.pubkeyAsMe(request.creatorPublicKey)}
								</p>
							</div>
						</div>

						<Separator />

						<div>
							<p className="text-sm text-muted-foreground mb-2">Description</p>
							<p className="text-base text-foreground leading-relaxed">
								{request.description}
							</p>
						</div>

						<Separator />

						<div>
							<p className="text-sm text-muted-foreground mb-2">Status</p>
							<Badge variant="outline">{request.status}</Badge>
						</div>

						<Separator />

						<div>
							<p className="text-sm text-muted-foreground mb-2">
								Your contracts
							</p>
							{request.contractsCount > 0 ? (
								<p className="text-base text-foreground leading-relaxed">
									You have {request.contractsCount}{" "}
									{request.contractsCount === 1 ? "contract" : "contracts"} for
									this request
									<br />
									Find them in{" "}
									<Link
										className="text-base font-medium text-foreground underline hover:text-primary transition-colors"
										to={`${Config.appRootUrl}/contracts`}
									>
										My Contracts page
									</Link>
								</p>
							) : (
								<p className="text-base text-foreground leading-relaxed">
									You don't have any contract for this request
								</p>
							)}
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-3 pt-4">
						<Button
							variant="outline"
							className="flex-1"
							onClick={() => onOpenChange(false)}
						>
							Close
						</Button>
						{isMine && request.status !== "canceled" && (
							<Button
								className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
								onClick={async () => {
									await cancelRequest.mutate({ requestId: request.externalId });
									onOpenChange(false);
								}}
							>
								Cancel Request
							</Button>
						)}
						{!isMine && (
							<Button
								className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
								onClick={() => setWizardOpen(true)}
							>
								Create Contract
							</Button>
						)}
					</div>
				</div>
			</SheetContent>

			<ContractCreationWizard
				request={request}
				open={wizardOpen}
				onOpenChange={setWizardOpen}
				onCreateContract={handleCreateContract}
				initialReleaseAddress={walletAddress || undefined}
			/>
		</Sheet>
	);
};

/*
fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[90vh] overflow-y-auto sm:max-w-md [&>button]:hidden
fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[90vh] overflow-y-auto sm:max-w-md [&>button]:hidden
 */
