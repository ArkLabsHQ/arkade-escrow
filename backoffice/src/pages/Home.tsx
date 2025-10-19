import { Link } from "react-router-dom";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import { FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import Config from "@/Config.ts";
import { toast } from "sonner";

const Home = () => {
	const [stats, setStats] = useState<{
		contracts: { total; active; disputed; settled };
	} | null>(null);

	const fetchStats = useCallback(async () => {
		try {
			const response = await fetch(`${Config.apiBaseUrl}/admin/v1/stats`);
			const result = await response.json();
			setStats(result.data);
		} catch (error) {
			toast.error("Failed to fetch contract statistics");
			console.error(error);
		}
	}, []);

	useEffect(() => {
		const interval = setInterval(() => {
			fetchStats();
		}, 5000);
		return () => clearInterval(interval);
	}, [fetchStats]);

	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="container mx-auto px-6 py-8">
				<h2 className="text-3xl font-bold text-foreground mb-8">Dashboard</h2>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<Link
						to={`${Config.appRootUrl}/contracts`}
						className="block transition-transform hover:scale-105"
					>
						<Card className="h-full hover:shadow-lg transition-shadow">
							<CardHeader>
								<div className="flex items-center gap-3 mb-2">
									<div className="p-2 bg-primary/10 rounded-lg">
										<FileText className="h-6 w-6 text-primary" />
									</div>
									<CardTitle>Contracts</CardTitle>
								</div>
								<CardDescription>
									View all contracts created by the users
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										Total contracts
									</span>
									<Badge variant="neutral" className="text-base px-3">
										{stats?.contracts?.total || "-"}
									</Badge>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										In progress
									</span>
									<Badge variant="success" className="text-base px-3">
										{stats?.contracts?.active || "-"}
									</Badge>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										Disputed
									</span>
									<Badge variant="warning" className="text-base px-3">
										{stats?.contracts?.disputed || "-"}
									</Badge>
								</div>
							</CardContent>
						</Card>
					</Link>
				</div>
			</main>
		</div>
	);
};

export default Home;
