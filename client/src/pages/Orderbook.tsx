import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { RequestCard } from "@/components/RequestCard";
import { RequestDetailSheet } from "@/components/RequestDetailSheet";
import { NewRequestSheet } from "@/components/NewRequestSheet";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import Config from "@/Config";
import axios from "axios";
import {
	ApiPaginatedEnvelope,
	GetEscrowContractDto,
	GetEscrowRequestDto,
} from "@/types/api";
import { useSession } from "@/components/SessionProvider";
import { useMessageBridge } from "@/components/MessageBus";
import { ContractDetailSheet } from "@/components/ContractDetailSheet";
import { ContractAction } from "@/components/ContractDetailSheet/ContractActions";
import useContractActionHandler from "@/components/ContractDetailSheet/useContractActionHandler";

// Orderbook page: list of all public requests
const Orderbook = () => {
	const { walletAddress } = useMessageBridge();
	const [selectedRequest, setSelectedRequest] =
		useState<GetEscrowRequestDto | null>(null);
	const [requestSheetOpen, setRequestSheetOpen] = useState(false);
	const [selectedContract, setSelectedContract] =
		useState<GetEscrowContractDto | null>(null);
	const [contractSheetOpen, setContractSheetOpen] = useState(false);
	const me = useSession();
	const { handleAction, isExecuting } = useContractActionHandler();
	const observerTarget = useRef<HTMLDivElement>(null);
	const [newRequestOpen, setNewRequestOpen] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [pullDistance, setPullDistance] = useState(0);
	const touchStartY = useRef<number>(0);
	const containerRef = useRef<HTMLDivElement>(null);

	// create request
	const createRequest = useMutation({
		mutationFn: async (data: {
			side: "receiver" | "sender";
			amount: number;
			description: string;
			public: boolean;
			receiverAddress?: string;
		}) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const res = await axios.post<{ data: GetEscrowRequestDto }>(
				`${Config.apiBaseUrl}/escrows/requests`,
				data,
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			return res.data.data;
		},
	});

	// Fetch orderbook with pagination (cursor + limit)
	const limit = 20;
	const {
		data,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
		isError,
		error,
		isPending,
	} = useInfiniteQuery({
		queryKey: ["orderbook", limit, refreshKey],
		initialPageParam: { cursor: undefined as string | undefined, limit },
		queryFn: async ({ pageParam }) => {
			const params = {
				limit: pageParam?.limit ?? limit,
				cursor: pageParam?.cursor,
			};
			const res = await axios.get<ApiPaginatedEnvelope<GetEscrowRequestDto>>(
				`${Config.apiBaseUrl}/escrows/requests/orderbook`,
				{
					params,
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
		// TODO: this must be under /requests/sse and be public
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
						// console.error("Unknown event type:", data.type);
						// not an error, this is just for requests
						break;
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
		setRequestSheetOpen(true);
	};

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		await new Promise((resolve) => setTimeout(resolve, 1000));
		setIsRefreshing(false);
		setPullDistance(0);
		toast.success("Orderbook refreshed", {
			description: "Latest data loaded successfully",
		});
	}, []);

	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		const scrollTop = containerRef.current?.scrollTop || 0;
		if (scrollTop === 0) {
			touchStartY.current = e.touches[0].clientY;
		}
	}, []);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			const scrollTop = containerRef.current?.scrollTop || 0;
			if (scrollTop === 0 && !isRefreshing) {
				const touchY = e.touches[0].clientY;
				const distance = touchY - touchStartY.current;
				if (distance > 0) {
					setPullDistance(Math.min(distance * 0.5, 80));
				}
			}
		},
		[isRefreshing],
	);

	const handleTouchEnd = useCallback(() => {
		if (pullDistance > 60 && !isRefreshing) {
			handleRefresh();
		} else {
			setPullDistance(0);
		}
	}, [pullDistance, isRefreshing, handleRefresh]);

	return (
		<div className="min-h-screen bg-gradient-subtle">
			<Header title={"Orderbook"} />

			<main
				ref={containerRef}
				className="container px-4 py-8 md:px-6"
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				style={{
					paddingTop: `${Math.max(32, 32 + pullDistance)}px`,

					transition:
						isRefreshing || pullDistance === 0
							? "padding-top 0.3s ease-out"
							: "none",
				}}
			>
				{/* Pull to Refresh Indicator */}
				<div
					className="fixed top-16 left-1/2 -translate-x-1/2 z-50 transition-all duration-300"
					style={{
						opacity: pullDistance > 0 ? 1 : 0,
						transform: `translateX(-50%) translateY(${Math.min(pullDistance - 20, 40)}px)`,
					}}
				>
					<div className="bg-background/95 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-elegant flex items-center gap-2">
						<RefreshCw
							className={`h-4 w-4 text-primary ${isRefreshing || pullDistance > 60 ? "animate-spin" : ""}`}
							style={{
								transform: `rotate(${pullDistance * 4}deg)`,
								transition: isRefreshing ? "none" : "transform 0.1s ease-out",
							}}
						/>
						<span className="text-sm font-medium text-foreground">
							{isRefreshing
								? "Refreshing..."
								: pullDistance > 60
									? "Release to refresh"
									: "Pull to refresh"}
						</span>
					</div>
				</div>

				{/* Quick Actions */}
				<div className="mb-8 flex flex-col sm:flex-row gap-3 animate-slide-up">
					<Button
						className="gap-2 bg-gradient-primary hover:opacity-90 transition-opacity w-full sm:w-auto"
						onClick={() => setNewRequestOpen(true)}
					>
						<Plus className="h-4 w-4" />
						New Request
					</Button>
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
							No more requests to load
						</div>
					)}
				</div>
			</main>

			{/* TODO: lift this part up in the tree because it will be repeated */}
			<RequestDetailSheet
				me={me}
				walletAddress={walletAddress}
				request={selectedRequest}
				open={requestSheetOpen}
				onOpenChange={(open) => {
					setRequestSheetOpen(open);
					setSelectedRequest(null);
				}}
				onContractCreated={(newContract) => {
					// Close request sheet and open contract sheet
					setRequestSheetOpen(false);
					setSelectedRequest(null);
					setSelectedContract(newContract);
					setContractSheetOpen(true);
				}}
			/>

			<NewRequestSheet
				open={newRequestOpen}
				onOpenChange={setNewRequestOpen}
				onSubmit={(data) => {
					createRequest.mutate(
						{
							...data,
							receiverAddress:
								data.side === "receiver" && walletAddress
									? walletAddress
									: undefined,
						},
						{
							onSuccess: (_) => {
								toast.success("Request created successfully!", {
									description: "Your request is now visible in the orderbook",
								});
								// Reset pagination and refetch from the first page
								setRefreshKey((k) => k + 1);
								window.scrollTo({ top: 0, behavior: "smooth" });
							},
							onError: (error) => {
								toast.error("Failed to create request", {
									description: error.message,
								});
							},
						},
					);
				}}
			/>

			<ContractDetailSheet
				contract={selectedContract}
				open={contractSheetOpen}
				onOpenChange={setContractSheetOpen}
				onContractAction={async (action: ContractAction, data) => {
					try {
						await handleAction({ action, ...data });
						toast.success("Action executed successfully");
					} catch (error) {
						console.error(error);
						toast.error("Failed to execute contract action");
					}
				}}
				me={me}
			/>
		</div>
	);
};

export default Orderbook;
