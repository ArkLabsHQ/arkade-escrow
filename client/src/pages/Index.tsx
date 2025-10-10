import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { RequestCard } from "@/components/RequestCard";
import { RequestDetailSheet } from "@/components/RequestDetailSheet";
import { NewRequestSheet } from "@/components/NewRequestSheet";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import Config from "@/Config";
import axios from "axios";
import { ApiPaginatedEnvelope, GetEscrowRequestDto } from "@/types/api";
import { useSession } from "@/components/SessionProvider";

const Index = () => {
	const [selectedRequest, setSelectedRequest] =
		useState<GetEscrowRequestDto | null>(null);
	const me = useSession();
	const observerTarget = useRef<HTMLDivElement>(null);
	const [newRequestOpen, setNewRequestOpen] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	const createContractFromRequest = useMutation({
		mutationFn: async (requestId: string) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const res = await axios.post(
				`${Config.apiBaseUrl}/escrows/contracts`,
				{ requestId },
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			return res.data;
		},
	});

	// create request
	const createRequest = useMutation({
		mutationFn: async (data: any) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const res = await axios.post<GetEscrowRequestDto>(
				`${Config.apiBaseUrl}/escrows/requests`,
				data,
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			return res.data;
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

	const handleCreateContract = (requestId: string) => {
		createContractFromRequest.mutate(requestId, {
			onSuccess: (resp) => {
				console.log(resp);
				toast.success("Contract created successfully!", {
					description: "You can now view and manage your contract.",
				});
			},
			onError: (error) => {
				toast.error("Failed to create contract", {
					description: error.message,
				});
			},
		});
	};

	const handleNewRequest = (data: any) => {
		console.log("New request data:", data);
		// In production, this would create the request via API
		createRequest.mutate(data, {
			onSuccess: (newRequest) => {
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
		});
	};

	return (
		<div className="min-h-screen bg-gradient-subtle">
			<Header notificationCount={3} />

			<main className="container px-4 py-8 md:px-6">
				{/* Quick Actions */}
				<div className="mb-8 flex gap-3 animate-slide-up">
					<Link to="/requests">
						<Button variant="outline" className="gap-2">
							<FileText className="h-4 w-4" />
							My Requests
						</Button>
					</Link>
					<Link to="/contracts">
						<Button variant="outline" className="gap-2">
							<FileText className="h-4 w-4" />
							My Contracts
						</Button>
					</Link>
					<Button
						className="gap-2 bg-gradient-primary hover:opacity-90 transition-opacity"
						onClick={() => setNewRequestOpen(true)}
					>
						<Plus className="h-4 w-4" />
						New Request
					</Button>
				</div>

				{/* Requests List */}
				<div className="space-y-4">
					<h2 className="text-xl font-semibold text-foreground">Orderbook</h2>

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
				open={selectedRequest !== null}
				onOpenChange={() => setSelectedRequest(null)}
				onCreateContract={handleCreateContract}
			/>

			<NewRequestSheet
				open={newRequestOpen}
				onOpenChange={setNewRequestOpen}
				onSubmit={handleNewRequest}
			/>
		</div>
	);
};

export default Index;
