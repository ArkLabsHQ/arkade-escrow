import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { RequestCard } from "@/components/RequestCard";
import { RequestDetailSheet } from "@/components/RequestDetailSheet";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { toast } from "sonner";
import Config from "@/Config";
import {
	ApiEnvelope,
	ApiPaginatedEnvelope,
	GetEscrowRequestDto,
} from "@/types/api";
import axios from "axios";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "@/components/SessionProvider";
import { useAppShell } from "@/components/AppShell/RpcProvider";
import { useParams } from "react-router";

export function Requests() {
	const { walletAddress } = useAppShell();
	const { externalId: paramRequestId } = useParams();
	const [selectedRequest, setSelectedRequest] =
		useState<GetEscrowRequestDto | null>(null);

	const me = useSession();

	const observerTarget = useRef<HTMLDivElement>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [sideFilter, setSideFilter] = useState<"all" | "sender" | "receiver">(
		"all",
	);
	const [refreshKey, setRefreshKey] = useState(0);

	// Fetch requests with pagination (cursor + limit)
	const limit = Config.itemsPerPage;
	const {
		data,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
		isError,
		error,
		isPending,
	} = useInfiniteQuery({
		queryKey: ["my-escrow-requests", limit, refreshKey],
		initialPageParam: { cursor: undefined as string | undefined, limit },
		queryFn: async ({ pageParam }) => {
			const params = {
				limit: pageParam?.limit ?? limit,
				cursor: pageParam?.cursor,
			};
			const res = await axios.get<ApiPaginatedEnvelope<GetEscrowRequestDto>>(
				`${Config.apiBaseUrl}/escrows/requests/mine`,
				{
					params,
					headers: { authorization: `Bearer ${me.getAccessToken()}` },
				},
			);
			return res.data;
		},
		getNextPageParam: (lastPage) => {
			const nextCursor = lastPage?.meta?.nextCursor ?? undefined;
			return nextCursor ? { cursor: nextCursor, limit } : undefined;
		},
	});

	if (isError) {
		console.error(error);
		toast.error("Failed to load requests");
	}

	// SSE listener for contract updates
	useEffect(() => {
		// TODO: this must be authenticated
		const eventSource = new EventSource(
			`${Config.apiBaseUrl}/escrows/contracts/sse`,
		);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				switch (data?.type) {
					case "new_request":
						setRefreshKey(refreshKey + 1);
						break;
					default:
						console.error("Unknown event type:", data.type);
				}
			} catch (error) {
				console.error("Error parsing SSE event:", error);
			}
		};

		eventSource.onerror = (error) => {
			console.error("SSE connection error:", error);
		};

		return () => {
			eventSource.close();
		};
	}, [refreshKey]);

	// Infinite scroll observer
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isPending) {
					fetchNextPage();
				}
			},
			{ threshold: 0.1 },
		);

		const currentTarget = observerTarget.current;
		if (currentTarget) {
			observer.observe(currentTarget);
		}

		return () => {
			if (currentTarget) {
				observer.unobserve(currentTarget);
			}
		};
	}, [hasNextPage, isPending, fetchNextPage]);

	const handleRequestClick = (request: GetEscrowRequestDto) => {
		setSelectedRequest(request);
	};

	useEffect(() => {
		if (paramRequestId !== undefined) {
			axios
				.get<ApiEnvelope<GetEscrowRequestDto>>(
					`${Config.apiBaseUrl}/escrows/requests/${paramRequestId ?? ""}`,
					{
						headers: { authorization: `Bearer ${me.getAccessToken()}` },
					},
				)
				.then((res) => {
					setSelectedRequest(res.data.data);
				});
		}
	}, [paramRequestId, me.getAccessToken]);

	return (
		<div className="min-h-screen bg-gradient-subtle">
			<Header title={"My Requests"} />

			<main className="container px-4 py-8 md:px-6">
				{/* Filters */}
				<div
					className="mb-6 flex flex-col gap-4 sm:flex-row animate-slide-up"
					style={{ animationDelay: "0.1s" }}
				>
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search requests..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
						/>
					</div>

					<Select
						value={sideFilter}
						onValueChange={(value: any) => setSideFilter(value)}
					>
						<SelectTrigger className="w-full sm:w-[180px]">
							<Filter className="mr-2 h-4 w-4" />
							<SelectValue placeholder="Filter by side" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Requests</SelectItem>
							<SelectItem value="sender">Sending</SelectItem>
							<SelectItem value="receiver">Receiving</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Requests List */}
				<div className="space-y-4">
					{data?.pages.length === 0 && !isPending && (
						<div className="text-center py-12 text-muted-foreground">
							No contracts found
						</div>
					)}

					<div className="grid gap-4">
						{data?.pages.map((page) =>
							page.data.map((escReq, index) => (
								<div
									key={escReq.externalId}
									className="animate-slide-up"
									style={{ animationDelay: `${0.2 + index * 0.05}s` }}
								>
									<RequestCard
										me={me}
										request={escReq}
										onClick={() => handleRequestClick(escReq)}
									/>
								</div>
							)),
						)}
					</div>

					{/* Loading indicator */}
					{isFetchingNextPage && (
						<div className="text-center py-8">
							<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
						</div>
					)}
					{/* Infinite scroll trigger */}
					<div ref={observerTarget} className="h-4" />

					{/* End of list message */}
					{!hasNextPage && (data?.pages.length ?? 0) > 0 && (
						<div className="text-center py-8 text-muted-foreground text-sm">
							No more contracts to load
						</div>
					)}
				</div>
			</main>

			<RequestDetailSheet
				me={me}
				request={selectedRequest}
				walletAddress={walletAddress}
				open={selectedRequest !== null}
				onOpenChange={() => setSelectedRequest(null)}
			/>
		</div>
	);
}

export default Requests;
