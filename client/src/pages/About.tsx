import { Link } from "react-router-dom";
import { ArrowLeft, Server, Globe, Network, KeyRound } from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import Config from "@/Config";
import { ApiEnvelope, GetArkInfoOutDto } from "@/types/api";
import BtnCopy from "@/components/BtnCopy";

const aboutItems = [
	{
		key: "arkServerUrl",
		label: "Ark Server URL",
		icon: Server,
	},
	{
		key: "escrowServerUrl",
		label: "Escrow Server URL",
		icon: Globe,
	},
	{
		key: "network",
		label: "Network",
		icon: Network,
	},
	{
		key: "escrowServerPublicKey",
		label: "Escrow Server Public Key",
		icon: KeyRound,
	},
];

export default function About() {
	const { data, error } = useQuery({
		queryKey: ["serverInfo"],
		queryFn: async () => {
			const res = await axios.get<ApiEnvelope<GetArkInfoOutDto>>(
				`${Config.apiBaseUrl}/ark/info`,
			);
			return res.data.data;
		},
	});

	useEffect(() => {
		if (error) {
			toast.error("Failed to fetch server info");
		}
	});

	const getValueForItem = (item: (typeof aboutItems)[number]) => {
		switch (item.key) {
			case "arkServerUrl":
				return data?.arkServerUrl ?? "-";
			case "escrowServerUrl":
				return Config.apiBaseUrl.replace("/api/v1", "");
			case "network":
				return data?.network ?? "-";
			case "escrowServerPublicKey":
				return data?.escrowServerPublicKey ?? "-";
			default:
				return "not found";
		}
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
								key={item.key}
								className="group relative rounded-xl border bg-card p-4 transition-all duration-300 animate-slide-up"
								style={{ animationDelay: `${index * 0.05}s` }}
							>
								<div className="flex items-start gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
										<item.icon className="h-4 w-4" />
									</div>

									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-muted-foreground">
											{item.label}
										</p>

										<p className="mt-1 font-mono text-sm break-all">
											{getValueForItem(item)}
										</p>
									</div>

									<BtnCopy value={getValueForItem(item)} />
								</div>
							</div>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
