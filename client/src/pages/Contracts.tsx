import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { ContractCard } from "@/components/ContractCard";
import { ContractDetailSheet } from "@/components/ContractDetailSheet";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import Config from "@/Config";
import {
	ApiPaginatedEnvelope,
	ExecuteEscrowContractOutDto,
	GetEscrowContractDto,
} from "@/types/api";
import { useSession } from "@/components/SessionProvider";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useMessageBridge } from "@/components/MessageBus";
import type { ApiEnvelope } from "../../../server/src/common/dto/envelopes";

const Contracts = () => {
	const { signTransaction } = useMessageBridge();
	const [selectedContract, setSelectedContract] =
		useState<GetEscrowContractDto | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const me = useSession();

	const observerTarget = useRef<HTMLDivElement>(null);
	const [requestIdFilter, setRequestIdFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		"all" | GetEscrowContractDto["status"]
	>("all");
	const [sideFilter, setSideFilter] = useState<"all" | "sender" | "receiver">(
		"all",
	);
	const [refreshKey, setRefreshKey] = useState(0);

	const acceptContract = useMutation({
		mutationFn: async (contractId: string) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const res = await axios.post<GetEscrowContractDto>(
				`${Config.apiBaseUrl}/escrows/contracts/${contractId}/accept`,
				{},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			return res.data;
		},
	});

	const executeContract = useMutation({
		mutationFn: async (input: { contractId: string; arkAddress: string }) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const res = await axios.post<ApiEnvelope<ExecuteEscrowContractOutDto>>(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/execute`,
				{ arkAddress: input.arkAddress },
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);

			if (res.status !== 201) {
				throw new Error("Failed to execute contract", {
					cause: new Error(`${res.status} - ${res.statusText}`),
				});
			}
			const { externalId, arkTx, checkpoints, vtxo } = res.data.data;
			console.log(`TEST!!! -> ${arkTx}`);
			const signed = await signTransaction({ arkTx, checkpoints, vtxo });
			console.log(`TEST!! SIGNED -> ${signed}`);

			const r = await axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/executions/${externalId}`,
				{
					arkTx: signed.tx,
					checkpoints: signed.checkpoints,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);

			console.log(r);
		},
	});

	const approveContractExecution = useMutation({
		mutationFn: async (input: {
			contractId: string;
			executionId: string;
			transaction: Transaction;
		}) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const signed = await signTransaction(input.transaction);

			console.log(signed);

			const r = await axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/executions/${input.executionId}`,
				{
					arkTx: signed.tx,
					checkpoints: signed.checkpoints,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);

			console.log(r);
		},
	});

	const disputeContract = useMutation({
		mutationFn: async (input: { contractId: string; reason: string }) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const r = await axios.post(
				`${Config.apiBaseUrl}/escrows/arbitrations`,
				{
					contractId: input.contractId,
					reason: input.reason,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			console.log(r);
		},
	});

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

	// TODO: Reset pagination when filters change
	// useEffect(() => {
	// 	setDisplayedContracts([]);
	// 	setPage(1);
	// 	setHasMore(true);
	// }, [requestIdFilter, statusFilter, sideFilter]);

	const handleContractClick = (contract: GetEscrowContractDto) => {
		setSelectedContract(contract);
		setSheetOpen(true);
	};

	return (
		<div className="min-h-screen bg-gradient-subtle">
			<Header notificationCount={3} />

			<main className="container px-4 py-8 md:px-6">
				{/* Page Header */}
				<div className="mb-6 space-y-2 animate-slide-up">
					<h1 className="text-2xl font-bold tracking-tight text-foreground">
						My Contracts
					</h1>
					<p className="text-muted-foreground">
						View and manage all your escrow contracts
					</p>
				</div>

				{/* Filters */}
				<div
					className="mb-6 flex flex-col gap-4 animate-slide-up"
					style={{ animationDelay: "0.1s" }}
				>
					<div className="flex flex-col gap-4 sm:flex-row">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by request ID..."
								value={requestIdFilter}
								onChange={(e) => setRequestIdFilter(e.target.value)}
								className="pl-10"
							/>
						</div>

						<Select
							value={statusFilter}
							onValueChange={(value: any) => setStatusFilter(value)}
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
							</SelectContent>
						</Select>

						<Select
							value={sideFilter}
							onValueChange={(value: any) => setSideFilter(value)}
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
									onClick={() => handleContractClick(contract)}
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
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				onContractAction={(
					action: string,
					{ contractId, walletAddress, executionId, transaction, reason },
				) => {
					switch (action) {
						case "accept": {
							acceptContract.mutate(contractId, {
								onSuccess: (d) => {
									toast.success("Contract accepted successfully");
									setRefreshKey(refreshKey + 1);
								},
								onError: (error) => {
									toast.error("Failed to accept contract");
								},
								onSettled: () => {},
							});
							return;
						}
						case "settle":
							if (!walletAddress) {
								return Promise.reject(
									new Error("Wallet address is required for execution"),
								);
							}
							executeContract.mutate(
								{ contractId, arkAddress: walletAddress },
								{
									onSuccess: (d) => {
										toast.success("Contract executed successfully");
										setRefreshKey(refreshKey + 1);
									},
									onError: (error) => {
										toast.error("Failed to execute contract");
									},
									onSettled: () => {},
								},
							);
							return;
						case "approve":
							if (!transaction || !executionId) {
								throw new Error("Transaction is required for approval");
							}
							approveContractExecution.mutate(
								{
									contractId,
									executionId,
									transaction,
								},
								{
									onSuccess: (d) => {
										toast.success("Settlement approved successfully");
										setRefreshKey(refreshKey + 1);
									},
									onError: (error) => {
										console.error(error);
										toast.error("Failed to execute settlement");
									},
									onSettled: () => {},
								},
							);
							return;
						case "dispute":
							if (!reason) {
								throw new Error("Reason is required for dispute");
							}
							disputeContract.mutate({ contractId, reason }, {});
							return;
						default:
							return Promise.reject(new Error(`Invalid action ${action}`));
					}
				}}
				me={me}
			/>
		</div>
	);
};

export default Contracts;
