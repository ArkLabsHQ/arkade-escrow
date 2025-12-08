import { Header } from "@/components/Header";

import { Link } from "react-router-dom";

import {
	ArrowLeft,
	User,
	Download,
	RotateCcw,
	Eye,
	EyeOff,
	Copy,
	Check,
	AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { useState } from "react";

import { toast } from "@/hooks/use-toast";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAppShell } from "@/components/AppShell/RpcProvider";
import BtnCopy from "@/components/BtnCopy";

const OBFUSCATED =
	"••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••";

export default function Identity() {
	const { xPublicKey, walletAddress, getPrivateKey, isHosted } = useAppShell();
	const [visiblePrivateKey, setVisiblePrivateKey] = useState<string | null>(
		null,
	);
	const [showPrivateKey, setShowPrivateKey] = useState(false);

	const handleReset = () => {
		toast({
			title: "Identity Reset",
			description: "This feature is not yet implemented.",
			variant: "destructive",
		});
	};

	return (
		<div className="min-h-screen bg-background">
			<Header title={"Identity"} />

			<main className="container px-4 py-6 md:px-6">
				<div className="space-y-6">
					<div className="flex items-center gap-3 animate-fade-in">
						<Link to="/settings">
							<Button
								variant="ghost"
								size="icon"
								className="rounded-xl hover:bg-accent"
							>
								<ArrowLeft className="h-5 w-5" />
							</Button>
						</Link>

						<div className="space-y-1">
							<h1 className="text-2xl font-bold tracking-tight">Identity</h1>

							<p className="text-muted-foreground">
								Manage your keys and wallet
							</p>
						</div>
					</div>

					<div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
						<Accordion type="single" collapsible className="space-y-3">
							{/* Details Section */}

							<AccordionItem
								value="details"
								className="rounded-xl border bg-card px-4 overflow-hidden"
							>
								<AccordionTrigger className="py-4 hover:no-underline">
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
											<User className="h-4 w-4" />
										</div>

										<div className="text-left">
											<p className="font-semibold">Details</p>

											<p className="text-sm text-muted-foreground">
												View your public key and wallet
											</p>
										</div>
									</div>
								</AccordionTrigger>

								<AccordionContent className="pb-4">
									<div className="space-y-4 pt-2">
										{/* Public Key */}

										<div className="rounded-lg bg-muted/50 p-4">
											<div className="flex items-center justify-between mb-2">
												<p className="text-sm font-medium text-muted-foreground">
													Public Key
												</p>
												{xPublicKey ? <BtnCopy value={xPublicKey} /> : null}
											</div>

											<p className="font-mono text-sm break-all">
												{xPublicKey}
											</p>
										</div>

										{/* Wallet Address */}

										<div className="rounded-lg bg-muted/50 p-4">
											<div className="flex items-center justify-between mb-2">
												<p className="text-sm font-medium text-muted-foreground">
													Wallet Address
												</p>
												{walletAddress ? (
													<BtnCopy value={walletAddress} />
												) : null}
											</div>

											<p className="font-mono text-sm break-all">
												{walletAddress ?? "Not connected"}
											</p>
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* Backup Section */}

							<AccordionItem
								value="backup"
								className="rounded-xl border bg-card px-4 overflow-hidden"
							>
								<AccordionTrigger className="py-4 hover:no-underline">
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
											<Download className="h-4 w-4" />
										</div>

										<div className="text-left">
											<p className="font-semibold">Backup</p>

											<p className="text-sm text-muted-foreground">
												Export your private key
											</p>
										</div>
									</div>
								</AccordionTrigger>

								<AccordionContent className="pb-4">
									<div className="space-y-4 pt-2">
										<Alert className="border-warning/50 bg-warning/10">
											<AlertTriangle className="h-4 w-4 text-warning" />

											<AlertTitle className="text-warning">
												Keep it safe!
											</AlertTitle>

											<AlertDescription className="text-warning/80">
												Never share your private key with anyone. Store it
												securely.
											</AlertDescription>
										</Alert>

										<div className="rounded-lg bg-muted/50 p-4">
											<div className="flex items-center justify-between mb-2">
												<p className="text-sm font-medium text-muted-foreground">
													Private Key
												</p>

												<div className="flex items-center gap-1">
													<Button
														variant="ghost"
														size="sm"
														className="h-8 px-2"
														onClick={() => {
															if (showPrivateKey) {
																setShowPrivateKey(false);
															} else {
																if (!visiblePrivateKey) {
																	getPrivateKey().then((priv) => {
																		setVisiblePrivateKey(priv);
																		setShowPrivateKey(true);
																	});
																} else {
																	setShowPrivateKey(true);
																}
															}
														}}
													>
														{showPrivateKey ? (
															<EyeOff className="h-4 w-4" />
														) : (
															<Eye className="h-4 w-4" />
														)}
													</Button>

													{visiblePrivateKey ? (
														<BtnCopy value={visiblePrivateKey} />
													) : (
														<BtnCopy value={() => getPrivateKey()} />
													)}
												</div>
											</div>

											<p className="font-mono text-sm break-all">
												{showPrivateKey ? visiblePrivateKey : OBFUSCATED}
											</p>
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* Reset Section */}

							<AccordionItem
								value="reset"
								className="rounded-xl border bg-card px-4 overflow-hidden"
							>
								<AccordionTrigger className="py-4 hover:no-underline">
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/5 text-destructive">
											<RotateCcw className="h-4 w-4" />
										</div>

										<div className="text-left">
											<p className="font-semibold">Reset</p>

											<p className="text-sm text-muted-foreground">
												Generate a new identity
											</p>
										</div>
									</div>
								</AccordionTrigger>

								<AccordionContent className="pb-4">
									<div className="space-y-4 pt-2">
										<Alert variant="destructive">
											<AlertTriangle className="h-4 w-4" />

											<AlertTitle>This operation cannot be undone</AlertTitle>

											<AlertDescription>
												Your current identity will be permanently deleted. Make
												sure you have backed up your private key.
											</AlertDescription>
										</Alert>

										<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
											<p className="text-sm text-muted-foreground mb-4">
												Have you backed up your key? Once reset, you will lose
												access to any funds associated with your current
												identity.
											</p>

											<Button
												variant="destructive"
												className="w-full"
												onClick={handleReset}
											>
												<RotateCcw className="h-4 w-4 mr-2" />
												Reset Identity
											</Button>
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</div>
				</div>
			</main>
		</div>
	);
}
