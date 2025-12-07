import { Header } from "@/components/Header";

import { Link } from "react-router-dom";

import {
	ArrowLeft,
	Server,
	Globe,
	Network,
	KeyRound,
	Copy,
	Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { useState } from "react";

import { toast } from "@/hooks/use-toast";

const aboutItems = [
	{
		label: "Ark Server URL",

		value: "https://ark.example.com",

		icon: Server,
	},

	{
		label: "Escrow Server URL",

		value: "https://escrow.example.com",

		icon: Globe,
	},

	{
		label: "Network",

		value: "Mainnet",

		icon: Network,
	},

	{
		label: "Escrow Server Public Key",

		value:
			"02a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789ab",

		icon: KeyRound,
	},
];

export default function About() {
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

	const handleCopy = async (value: string, index: number) => {
		await navigator.clipboard.writeText(value);

		setCopiedIndex(index);

		toast({
			title: "Copied to clipboard",

			description: "The value has been copied to your clipboard.",
		});

		setTimeout(() => setCopiedIndex(null), 2000);
	};

	return (
		<div className="min-h-screen bg-background">
			<Header title="About" />

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
							<h1 className="text-2xl font-bold tracking-tight">About</h1>

							<p className="text-muted-foreground">
								Server configuration and network info
							</p>
						</div>
					</div>

					<div className="space-y-3">
						{aboutItems.map((item, index) => (
							<div
								key={item.label}
								className="group relative rounded-xl border bg-card p-4 transition-all duration-300 hover:bg-accent/30 animate-slide-up"
								style={{ animationDelay: `${index * 0.05}s` }}
							>
								<div className="flex items-start gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
										<item.icon className="h-4 w-4" />
									</div>

									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-muted-foreground">
											{item.label}
										</p>

										<p className="mt-1 font-mono text-sm break-all">
											{item.value}
										</p>
									</div>

									<Button
										variant="ghost"
										size="icon"
										className="shrink-0 h-8 w-8 rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100"
										onClick={() => handleCopy(item.value, index)}
									>
										{copiedIndex === index ? (
											<Check className="h-4 w-4 text-success" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
