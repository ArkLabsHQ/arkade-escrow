import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { ContractCard } from "@/components/ContractCard";
import { ContractDetailSheet } from "@/components/ContractDetailSheet";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import Config from "@/Config";
import { ApiPaginatedEnvelope, GetEscrowContractDto } from "@/types/api";
import { useSession } from "@/components/SessionProvider";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useMessageBridge } from "@/components/MessageBus";

import { ApiEnvelopeShellDto } from "../../../server/src/common/dto/envelopes";
import useContractActionHandler from "@/components/ContractDetailSheet/useContractActionHandler";
import { ContractAction } from "@/components/ContractDetailSheet/ContractActions";

const Contracts = () => {
	const { getWalletBalance } = useMessageBridge();
	const [walletBalance, setWalletBalance] = useState<number | undefined>();

	const [selectedContract, setSelectedContract] =
		useState<GetEscrowContractDto | null>(null);
	const [sheetOpen, setSheetOpen] = useState<{
		open: boolean;
		action?: ContractAction;
	}>({ open: false });
	const me = useSession();
	const { handleAction, isHandling } = useContractActionHandler();

	const observerTarget = useRef<HTMLDivElement>(null);
	const [statusFilter, setStatusFilter] = useState<
		"all" | GetEscrowContractDto["status"]
	>("all");
	const [sideFilter, setSideFilter] = useState<"all" | "sender" | "receiver">(
		"all",
	);
	const [refreshKey, setRefreshKey] = useState(0);

	const queryClient = useQueryClient();

	// Fetch contracts with pagination (cursor + limit)
	const limit = Config.itemsPerPage;
	const {
		data,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
		isError,
		error,
		isPending,
		refetch,
	} = useInfiniteQuery({
		queryKey: ["my-escrow-contracts", limit, refreshKey],
		initialPageParam: { cursor: undefined as string | undefined, limit },
		queryFn: async ({ pageParam }) => {
			const params = {
				limit: pageParam?.limit ?? limit,
				cursor: pageParam?.cursor,
				status: statusFilter === "all" ? undefined : statusFilter,
				side: sideFilter === "all" ? undefined : sideFilter,
			};
			const res = await axios.get<ApiPaginatedEnvelope<GetEscrowContractDto>>(
				`${Config.apiBaseUrl}/escrows/contracts`,
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

	// Fetch a single contract and update it in-place
	const refreshOneContract = useCallback(
		async (externalId: string) => {
			try {
				const res = await axios.get<ApiEnvelopeShellDto<GetEscrowContractDto>>(
					`${Config.apiBaseUrl}/escrows/contracts/${externalId}`,
					{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
				);
				const updated = res.data;
				// 2) Update list cache
				queryClient.setQueryData(
					["my-escrow-contracts", limit, refreshKey],
					(input: {
						pages: ApiPaginatedEnvelope<GetEscrowContractDto>[];
						pageParams: unknown;
					}) => {
						if (!input) return input;
						const pageIdx = input.pages.findIndex((p) =>
							p.data.some((c) => c.externalId === externalId),
						);
						if (pageIdx === -1) return input;
						const items = input.pages[pageIdx].data;
						const idx = items.findIndex((c) => c.externalId === externalId);
						if (idx === -1) return input; // not loaded on this page
						const nextItems = items.slice();
						nextItems[idx] = { ...items[idx], ...updated.data };
						const nextPages = input.pages.slice();
						nextPages[pageIdx] = { ...input.pages[pageIdx], data: nextItems };
						return { ...input, pages: nextPages };
					},
				);

				// 3) Update detail cache (optional)
				queryClient.setQueryData(["contract", externalId], { data: updated });
			} catch (e) {
				console.error(e);
				toast.error("Failed to refresh contract");
			}
		},
		[limit, me.getAccessToken, queryClient.setQueryData, refreshKey],
	);

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
					case "new_contract":
						setRefreshKey(refreshKey + 1);
						break;
					case "contract_updated":
						refreshOneContract(data.externalId);
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
	}, [refreshKey, refreshOneContract]);

	if (isError) {
		console.error(error);
		toast.error("Failed to load contracts");
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

	const handleContractClick = (
		contract: GetEscrowContractDto,
		action?: ContractAction,
	) => {
		getWalletBalance().then((wb) => setWalletBalance(wb.available));
		setSelectedContract(contract);
		setSheetOpen({ open: true, action });
	};

	return (
		<div className="min-h-screen bg-gradient-subtle">
			<Header title={"My Contracts"} />

			<main className="container px-4 py-8 md:px-6">
				{/* Filters */}
				<div
					className="mb-6 flex flex-col gap-4 animate-slide-up"
					style={{ animationDelay: "0.1s" }}
				>
					<div className="flex flex-col gap-4 sm:flex-row">
						<Select
							value={statusFilter}
							onValueChange={(value: any) => {
								setStatusFilter(value);
								setRefreshKey(refreshKey + 1);
							}}
						>
							<SelectTrigger className="w-full sm:w-[200px]">
								<Filter className="mr-2 h-4 w-4" />
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Statuses</SelectItem>
								<SelectItem value="draft">Draft</SelectItem>
								<SelectItem value="created">Created</SelectItem>
								<SelectItem value="funded">Funded</SelectItem>
								<SelectItem value="pending-execution">
									Pending Execution
								</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
								<SelectItem value="canceled">Canceled</SelectItem>
								<SelectItem value="under-arbitration">
									Under Arbitration
								</SelectItem>
							</SelectContent>
						</Select>

						<Select
							value={sideFilter}
							onValueChange={(value: any) => {
								setSideFilter(value);
								setRefreshKey(refreshKey + 1);
							}}
						>
							<SelectTrigger className="w-full sm:w-[180px]">
								<Filter className="mr-2 h-4 w-4" />
								<SelectValue placeholder="Filter by side" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Sides</SelectItem>
								<SelectItem value="sender">Sending</SelectItem>
								<SelectItem value="receiver">Receiving</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Contracts List */}
				<div className="space-y-4">
					{data?.pages.length === 0 && !isPending && (
						<div className="text-center py-12 text-muted-foreground">
							No contracts found
						</div>
					)}

					{data?.pages.map((page) =>
						page.data.map((contract, index) => (
							<div
								key={`${contract.externalId}-${index}`}
								className="animate-slide-up"
								style={{ animationDelay: `${0.05 * (index % 10)}s` }}
							>
								<ContractCard
									contract={contract}
									onClick={(action) => handleContractClick(contract, action)}
									me={me}
								/>
							</div>
						)),
					)}

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

			<ContractDetailSheet
				contract={selectedContract}
				open={sheetOpen.open}
				runAction={sheetOpen.action}
				balance={walletBalance}
				onOpenChange={(open) => {
					setSheetOpen({ open });
					setTimeout(() => setSelectedContract(null), 250);
				}}
				onContractAction={async (actionData) => {
					try {
						await handleAction(actionData);
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

export default Contracts;
