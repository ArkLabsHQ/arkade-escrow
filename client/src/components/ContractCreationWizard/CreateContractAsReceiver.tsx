import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ArrowDownLeft, Copy, Info, QrCode, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ArkAddress } from "@arkade-os/sdk";
import { GetEscrowRequestDto } from "@/types/api";
import { shortArkAddress, shortKey } from "@/lib/utils";
import { RequestAmount } from "@/components/ContractCreationWizard/RequestAmount";

type Props = {
	request: GetEscrowRequestDto;
	open: boolean;
	initialReleaseAddress?: string;
	onOpenChange: (open: boolean) => void;
	onCreateContract: (requestId: string, releaseAddress?: string) => void;
};

export const CreateContractAsReceiver = ({
	request,
	open,
	initialReleaseAddress,
	onOpenChange,
	onCreateContract,
}: Props) => {
	const [step, setStep] = useState(1);
	const [releaseAddress, setReleaseAddress] = useState(initialReleaseAddress);

	const handlePaste = async () => {
		const text = await navigator.clipboard.readText().catch(() => "");
		try {
			const addr = ArkAddress.decode(text);
			setReleaseAddress(addr.encode());
			toast.success("Address pasted from clipboard");
		} catch (err) {
			toast.error("Not a valid ARK address. Please try again.");
		}
	};

	const handleQRScan = () => {
		toast.info("QR code scanning will be implemented");
	};

	const handleReset = () => {
		setReleaseAddress(initialReleaseAddress);
	};

	const handleNext = () => {
		setStep(2);
	};

	const handleBack = () => {
		setStep(1);
	};

	const handleCreate = () => {
		onCreateContract(request.externalId, releaseAddress);
		onOpenChange(false);
		setStep(1); // Reset for next time
	};

	const handleCancel = () => {
		onOpenChange(false);
		setStep(1); // Reset for next time
	};

	const roleDescription = `You will receive ${request.amount} SAT from ${shortKey(request.creatorPublicKey)}`;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md [&>button]:hidden">
				<DialogHeader>
					<DialogTitle>
						<span>Create Contract</span>
					</DialogTitle>
					<DialogDescription>(Step {step} of 2)</DialogDescription>
				</DialogHeader>

				{/* Summary */}
				<div className="space-y-6 animate-fade-in">
					<div className="space-y-4">
						<div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border">
							<div className="rounded-full p-2 bg-success/10 text-success shrink-0">
								<ArrowDownLeft className="h-5 w-5" />
							</div>

							<p className="text-base font-medium text-foreground leading-relaxed pt-1">
								{roleDescription}
							</p>
						</div>
						<RequestAmount amount={request.amount} side={"receiver"} />
					</div>

					<div className="space-y-6 animate-fade-in">
						<div className="space-y-2">
							<div className="bg-muted/30 rounded-lg p-3 border border-border">
								<p className="text-sm text-foreground leading-relaxed">
									{request.description}
								</p>
							</div>
						</div>
					</div>

					{step === 1 ? (
						<>
							{/* Release Address */}
							<div className="space-y-3">
								<Label htmlFor="releaseAddress">Release Address</Label>
								{/** biome-ignore lint/correctness/useUniqueElementIds: unique */}
								<Input
									id="releaseAddress"
									value={
										releaseAddress ? shortArkAddress(releaseAddress, 16) : ""
									}
									onChange={(e) => setReleaseAddress(e.target.value)}
									className="font-mono text-xs"
									placeholder="Enter release address"
								/>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleReset}
										className="flex-1"
									>
										<RotateCcw className="h-4 w-4" />
										Reset
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handlePaste}
										className="flex-1"
									>
										<Copy className="h-4 w-4" />
										Paste
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleQRScan}
										className="flex-1"
									>
										<QrCode className="h-4 w-4" />
										Scan QR
									</Button>
								</div>
								<div className="flex gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
									<Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
									<p className="text-xs text-muted-foreground leading-relaxed">
										The address where funds will be released upon contract
										fulfillment. You can change it now or update it later if
										needed.
									</p>
								</div>
							</div>

							{/* Actions */}
							<div className="flex gap-3 pt-2">
								<Button
									variant="outline"
									className="flex-1"
									onClick={handleCancel}
								>
									Cancel
								</Button>
								<Button
									className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
									onClick={handleNext}
								>
									Next
								</Button>
							</div>
						</>
					) : (
						<>
							{/* Step 2: Final Summary */}
							<div className="space-y-4">
								<div className="space-y-2">
									<Label>Release Address</Label>
									<div className="bg-muted/50 rounded-lg p-3 border border-border">
										<p className="font-mono text-xs break-all text-foreground text-wrap">
											{releaseAddress}
										</p>
									</div>
								</div>
							</div>

							{/* Actions */}
							<div className="flex gap-3 pt-2">
								<Button
									variant="outline"
									className="flex-1"
									onClick={handleBack}
								>
									Back
								</Button>
								<Button
									className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
									onClick={handleCreate}
								>
									Create Contract
								</Button>
							</div>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
