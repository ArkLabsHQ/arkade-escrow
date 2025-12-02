import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	ArrowDownLeft,
	ArrowUpRight,
	Copy,
	QrCode,
	Undo,
	Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ArkAddress } from "@arkade-os/sdk";
import { GetEscrowRequestDto } from "@/types/api";
import { shortKey } from "@/lib/utils";

type Props = {
	request: GetEscrowRequestDto;
	open: boolean;
	initialReleaseAddress?: string;
	onOpenChange: (open: boolean) => void;
	onCreateContract: (requestId: string, releaseAddress?: string) => void;
};

export const ContractCreationWizard = ({
	request,
	open,
	initialReleaseAddress,
	onOpenChange,
	onCreateContract,
}: Props) => {
	const [step, setStep] = useState(1);
	const [releaseAddress, setReleaseAddress] = useState(initialReleaseAddress);

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			const addr = ArkAddress.decode(text);
			setReleaseAddress(addr.encode());
			toast.success("Address pasted from clipboard");
		} catch (err) {
			toast.error("Failed to paste from clipboard");
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

	const roleDescription =
		request.side === "sender"
			? `You will send ${request.amount} SAT to ${request}`
			: `You will receive ${request.amount} SAT from ${shortKey(request.creatorPublicKey)}`;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span>Create Contract</span>
						<span className="text-sm text-muted-foreground font-normal">
							(Step {step} of 2)
						</span>
					</DialogTitle>
					<DialogDescription>
						{step === 1
							? "Configure your contract details"
							: "Review and confirm your contract"}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 animate-fade-in">
					{step === 1 ? (
						<>
							{/* Summary */}
							<div className="bg-gradient-shine rounded-lg p-4 border border-border space-y-3">
								<div className="flex items-center gap-3">
									<div
										className={`rounded-lg p-2 ${
											request.side === "receiver"
												? "bg-success/10 text-success"
												: "bg-primary/10 text-primary"
										}`}
									>
										{request.side === "receiver" ? (
											<ArrowDownLeft className="h-5 w-5" />
										) : (
											<ArrowUpRight className="h-5 w-5" />
										)}
									</div>
									<div className="flex-1">
										<p className="text-sm text-muted-foreground">Your Role</p>
										<p className="text-base font-medium">{roleDescription}</p>
									</div>
								</div>
								<div className="flex items-baseline gap-2 pt-2 border-t border-border/50">
									<Wallet className="h-4 w-4 text-muted-foreground mt-1" />
									<div>
										<p className="text-2xl font-bold text-foreground">
											{request.amount}
										</p>
										<p className="text-xs text-muted-foreground">SAT</p>
									</div>
								</div>
							</div>

							{/* Release Address */}
							<div className="space-y-3">
								<Label htmlFor="releaseAddress">Release Address</Label>
								{/** biome-ignore lint/correctness/useUniqueElementIds: unique */}
								<Input
									id="releaseAddress"
									value={releaseAddress}
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
										<Undo className="h-4 w-4" />
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
								<p className="text-xs text-muted-foreground leading-relaxed">
									This is your current wallet's release address. You can change
									it by pasting a new address or scanning a QR code. You can
									also update it later if needed.
								</p>
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
								<div className="bg-gradient-shine rounded-lg p-4 border border-border space-y-3">
									<div className="flex items-center gap-3">
										<div
											className={`rounded-lg p-2 ${
												request.side === "receiver"
													? "bg-success/10 text-success"
													: "bg-primary/10 text-primary"
											}`}
										>
											{request.side === "receiver" ? (
												<ArrowDownLeft className="h-5 w-5" />
											) : (
												<ArrowUpRight className="h-5 w-5" />
											)}
										</div>
										<div className="flex-1">
											<p className="text-sm text-muted-foreground">Your Role</p>
											<p className="text-base font-medium">{roleDescription}</p>
										</div>
									</div>
									<div className="flex items-baseline gap-2 pt-2 border-t border-border/50">
										<Wallet className="h-4 w-4 text-muted-foreground mt-1" />
										<div>
											<p className="text-2xl font-bold text-foreground">
												{request.amount}
											</p>
											<p className="text-xs text-muted-foreground">SAT</p>
										</div>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Release Address</Label>
									<div className="bg-muted/50 rounded-lg p-3 border border-border">
										<p className="font-mono text-xs break-all text-foreground">
											{releaseAddress}
										</p>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Description</Label>
									<div className="bg-muted/50 rounded-lg p-3 border border-border">
										<p className="text-sm text-foreground">
											{request.description}
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
