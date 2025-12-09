import { Header } from "@/components/Header";
import {
	AlertTriangle,
	EyeOff,
	UserPlus,
	ClipboardPaste,
	Eye,
	Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import BtnCopy from "@/components/BtnCopy";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { SingleKey } from "@arkade-os/sdk";
import {
	encryptAndStorePrivateKey,
	loadAndDecryptPrivateKey,
} from "@/lib/storage";
import { Logo } from "@/components/Logo";

type Props = {
	onNewIdentity: (identity: SingleKey) => void;
};

export default function IdentitySetup({ onNewIdentity }: Props) {
	const [privateKey, setPrivateKey] = useState<string | undefined>();
	const [showPrivateKey, setShowPrivateKey] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	// biome-ignore lint/correctness/useExhaustiveDependencies: very first render only
	useEffect(() => {
		loadAndDecryptPrivateKey()
			.then((key) => {
				if (key) {
					onNewIdentity(SingleKey.fromHex(key));
				}
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	const handleCreateIdentity = async () => {
		try {
			const identity = SingleKey.fromHex(privateKey ?? "invalid");
			await encryptAndStorePrivateKey(identity.toHex());
			onNewIdentity(identity);
		} catch (e) {
			console.error("error creating identity", e);
			toast.error(
				"Failed to create identity. Please check your private key and try again.",
			);
		}
	};
	const handleGenerateKey = () => {
		const privKey = SingleKey.fromRandomBytes();
		setPrivateKey(privKey.toHex());
		toast.success("A new private key has been generated.");
	};
	const handlePasteResetKey = async () => {
		const text = await navigator.clipboard.readText();
		setPrivateKey(text);
		toast.success("Private key has been pasted.");
	};
	const onPrivateKeyChange = (value: string) => {
		console.log(value);
		setPrivateKey(value);
	};

	if (isLoading) {
		return (
			<div className="fixed inset-0 flex items-center justify-center bg-gradient-subtle">
				<div className="absolute inset-0 bg-gradient-shine opacity-50" />

				<div className="relative flex flex-col items-center space-y-8 animate-slide-up">
					<div className="relative">
						<div className="absolute inset-0 blur-2xl bg-primary/30 rounded-full animate-pulse-glow" />
						<div className="relative animate-spin-slow">
							<Logo size={80} />
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<Header title={"Ark Escrow"} hideButtons={true} />

			<main className="container px-4 py-6 md:px-6">
				<div className="space-y-6">
					<div className="flex items-center gap-3 animate-fade-in">
						<div className="space-y-1">
							<h1 className="text-2xl font-bold tracking-tight mb-4">
								Configure your identity
							</h1>
							<p className="text-muted-foreground">
								You need an identity to participate in an escrow using our
								services.
								<br />
								<br />
								You can create a new identity or use an existing one by using
								the private key associated with it. <br />
							</p>
						</div>
					</div>

					<div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
						<div className="space-y-4 pt-2">
							<Alert variant="destructive" className="mb-4">
								<AlertTriangle className="h-4 w-4" />
								<AlertTitle>Back up your private key!</AlertTitle>
								<AlertDescription>
									Once reset, you will lose access to any contracts associated
									with your current identity.
									<br />
									This may lead to the loss of funds.
								</AlertDescription>
							</Alert>

							{/* Private Key Input */}

							<div className="rounded-lg bg-muted/50 p-4">
								<div className="flex items-center justify-between mb-2">
									<p className="text-sm font-medium text-muted-foreground">
										Private Key (hex)
									</p>

									<div className="flex items-center gap-1">
										<Button
											variant="ghost"
											size="sm"
											className="h-8 px-2"
											onClick={() => setShowPrivateKey(!showPrivateKey)}
										>
											{showPrivateKey ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</Button>

										<BtnCopy value={privateKey ?? ""} disabled={!privateKey} />

										<Button
											variant="ghost"
											size="sm"
											className="h-8 px-2"
											onClick={handlePasteResetKey}
										>
											<ClipboardPaste className="h-4 w-4" />
										</Button>
									</div>
								</div>

								<Input
									type={showPrivateKey ? "text" : "password"}
									value={privateKey ?? ""}
									onChange={(e) => onPrivateKeyChange(e.target.value)}
									placeholder="Enter or paste your private key"
									className="font-mono text-sm bg-background"
								/>
							</div>

							{/* Action Buttons */}

							<div className="flex flex-col gap-3">
								<Button
									variant="outline"
									size="lg"
									className="w-full h-14 text-base"
									onClick={handleGenerateKey}
								>
									<Sparkles className="h-5 w-5 mr-2" />
									Generate private key for me
								</Button>

								<Button
									variant="default"
									size="lg"
									className="w-full h-14 text-base"
									onClick={handleCreateIdentity}
								>
									<UserPlus className="h-5 w-5 mr-2" />
									Create new identity
								</Button>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
