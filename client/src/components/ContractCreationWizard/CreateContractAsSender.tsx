import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { ArrowUpRight } from "lucide-react";
import { GetEscrowRequestDto } from "@/types/api";
import { shortKey } from "@/lib/utils";
import { RequestDescription } from "@/components/ContractCreationWizard/RequestDescription";
import { RequestAmount } from "@/components/ContractCreationWizard/RequestAmount";

type Props = {
	request: GetEscrowRequestDto;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreateContract: (requestId: string, releaseAddress?: string) => void;
};

export const CreateContractAsSender = ({
	request,
	open,
	onOpenChange,
	onCreateContract,
}: Props) => {
	const mySide = request.side === "receiver" ? "sender" : "receiver";

	const handleCreate = () => {
		onCreateContract(request.externalId);
		onOpenChange(false);
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	const roleDescription = `You will send ${request.amount} SAT to ${shortKey(request.creatorPublicKey)}`;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md [&>button]:hidden">
				<DialogHeader>
					<DialogTitle>Create Contract</DialogTitle>
				</DialogHeader>

				<div className="space-y-6 animate-fade-in">
					<div className="space-y-4">
						<div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border">
							<div className="rounded-full p-2 bg-primary/10 text-primary shrink-0">
								<ArrowUpRight className="h-5 w-5" />
							</div>

							<p className="text-base font-medium text-foreground leading-relaxed pt-1">
								{roleDescription}
							</p>
						</div>

						<RequestDescription description={request.description} />
						<RequestAmount amount={request.amount} side={"sender"} />
					</div>

					{/* Actions */}
					<div className="flex gap-3 pt-2">
						<Button variant="outline" className="flex-1" onClick={handleCancel}>
							Cancel
						</Button>
						<Button
							className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
							onClick={handleCreate}
						>
							Create Contract
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
