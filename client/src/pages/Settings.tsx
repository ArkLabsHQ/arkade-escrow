import { Header } from "@/components/Header";

import { Link } from "react-router-dom";

import { Info, Key, ChevronRight } from "lucide-react";
import { useAppShell } from "@/components/AppShell/RpcProvider";

export default function Settings() {
	const { isHosted } = useAppShell();
	console.log(`isHosted: ${isHosted}`);
	const settingsItems = [
		{
			title: "About",
			description: "Server configuration and network info",
			icon: Info,
			href: "/settings/about",
		},
		// hosted apps rely on the gues Wallet's identity management
		isHosted
			? null
			: {
					title: "Identity",
					description: "Manage your keys and wallet",
					icon: Key,
					href: "/settings/identity",
				},
	].filter((_) => _ !== null);
	return (
		<div className="min-h-screen bg-background">
			<Header title={"Setting"} />

			<main className="container px-4 py-6 md:px-6">
				<div className="space-y-6">
					<div className="space-y-1 animate-fade-in">
						<h1 className="text-2xl font-bold tracking-tight">Settings</h1>

						<p className="text-muted-foreground">
							Manage your app configuration
						</p>
					</div>

					<div className="grid gap-3">
						{settingsItems.map((item, index) => (
							<Link
								key={item.title}
								to={item.href}
								className="group relative flex items-center gap-4 rounded-xl border bg-card p-4 transition-all duration-300 hover:bg-accent/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 animate-slide-up"
								style={{ animationDelay: `${index * 0.1}s` }}
							>
								<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary transition-transform duration-300 group-hover:scale-110">
									<item.icon className="h-5 w-5" />
								</div>

								<div className="flex-1">
									<h3 className="font-semibold">{item.title}</h3>

									<p className="text-sm text-muted-foreground">
										{item.description}
									</p>
								</div>

								<ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
							</Link>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
