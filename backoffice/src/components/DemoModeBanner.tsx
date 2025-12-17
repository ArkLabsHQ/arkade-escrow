import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { AlertTriangle } from "lucide-react";
import Config from "@/Config";

type ServerInfo = {
	demoMode: boolean;
};

export function DemoModeBanner() {
	const { data } = useQuery({
		queryKey: ["serverInfo"],
		queryFn: async () => {
			const res = await axios.get<{ data: ServerInfo }>(
				`${Config.apiBaseUrl}/ark/info`,
			);
			return res.data.data;
		},
		staleTime: 1000 * 60 * 5, // Cache for 5 minutes
	});

	if (!data?.demoMode) {
		return null;
	}

	return (
		<div className="bg-yellow-500/90 text-yellow-950 px-4 py-2 text-center text-sm font-medium sticky top-0 z-[60] flex items-center justify-center gap-2">
			<AlertTriangle className="h-4 w-4" />
			<span>
				Demo Mode: Disputes are auto-resolved. Do not use for real transactions.
			</span>
		</div>
	);
}
