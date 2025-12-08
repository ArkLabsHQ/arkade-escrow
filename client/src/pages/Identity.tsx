import { Header } from "@/components/Header";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAppShell } from "@/components/AppShell/RpcProvider";
import BtnCopy from "@/components/BtnCopy";
import { useLogout } from "@/components/SessionProvider";

export default function Identity() {
	const { xPublicKey } = useAppShell();
	const logout = useLogout();

	const handleReset = () => {
		logout();
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
							<p className="text-muted-foreground">Manage your identity</p>
						</div>
					</div>

					<div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
						<div className="space-y-4 pt-2">
							{/* Public Key */}
							<div className="rounded-lg bg-muted/50 p-4">
								<div className="flex items-center justify-between mb-2">
									<p className="text-sm font-medium text-muted-foreground">
										Public Key
									</p>
									{xPublicKey ? <BtnCopy value={xPublicKey} /> : null}
								</div>

								<p className="font-mono text-sm break-all">{xPublicKey}</p>
							</div>
						</div>

						{/* Reset Section */}
						<div className="space-y-4 pt-2">
							<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
								<Alert variant="destructive">
									<AlertTriangle className="h-4 w-4" />

									<AlertTitle>This operation cannot be undone</AlertTitle>

									<AlertDescription>
										Once reset, you will lose access to any contracts associated
										with your current identity.
									</AlertDescription>
								</Alert>

								<Button
									variant="destructive"
									className="w-full mt-4"
									onClick={handleReset}
								>
									<RotateCcw className="h-4 w-4 mr-2" />
									Reset Identity
								</Button>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
