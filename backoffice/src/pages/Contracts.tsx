import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Contract {
	externalId: string;
	senderPublicKey: string;
	receiverPublicKey: string;
	amount: number;
	status: string;
	description: string;
	virtualCoins: Array<{ value: number }>;
	createdAt: number;
	updatedAt: number;
}

const Contracts = () => {
	const [contracts, setContracts] = useState<Contract[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(true);
	const [total, setTotal] = useState(0);
	const observerTarget = useRef<HTMLDivElement>(null);



	const fetchContracts = useCallback(
		async (nextCursor?: string,options?: { force?: boolean }) => {
            // Change: allow bypassing the early-return when force is true
            if (!nextCursor && contracts.length > 0 && !options?.force) return; // Already loaded initial data


            const isInitialLoad = !nextCursor;
			if (isInitialLoad) {
				setLoading(true);
			} else {
				setLoadingMore(true);
			}

			try {
				const url = nextCursor
					? `http://localhost:3002/api/admin/v1/contracts?limit=20&cursor=${nextCursor}`
					: `http://localhost:3002/api/admin/v1/contracts?limit=20`;

				const response = await fetch(url);
				const result = await response.json();

				if (isInitialLoad) {
					setContracts(result.data || []);
				} else {
					setContracts((prev) => [...prev, ...(result.data || [])]);
				}

				setTotal(result.meta?.total || 0);
				setCursor(result.meta?.nextCursor || null);
				setHasMore(!!result.meta?.nextCursor);
			} catch (error) {
				toast.error("Failed to fetch contracts");
				console.error(error);
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[contracts.length],
	);

	useEffect(() => {
		fetchContracts();
	}, []);

    const refetchFromStart = useCallback(async () => {
        setContracts([]);
        setCursor(null);
        setHasMore(true);
        setTotal(0);
        await fetchContracts(undefined, { force: true });
    }, [fetchContracts]);

    // SSE listener for contract updates
    useEffect(() => {
        const eventSource = new EventSource(
            "http://localhost:3002/api/admin/v1/contracts/sse",
        );

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                refetchFromStart()
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
    }, []);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
					fetchContracts(cursor || undefined);
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
	}, [cursor, hasMore, loadingMore, loading, fetchContracts]);

	const shortenKey = (key: string) => {
		if (!key) return "";
		return `${key.slice(0, 8)}...${key.slice(-8)}`;
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString();
	};

	const calculateFunding = (virtualCoins: Array<{ value: number }>) => {
		return virtualCoins.reduce((sum, coin) => sum + coin.value, 0);
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-background">
				<Header />
				<main className="container mx-auto px-6 py-8">
					<p className="text-muted-foreground">Loading contracts...</p>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="container mx-auto px-6 py-8">
				<Link
					to="/"
					className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
				>
					<ArrowLeft size={20} />
					<span>Back to Home</span>
				</Link>
				<div className="mb-6">
					<h2 className="text-3xl font-bold text-foreground mb-2">Contracts</h2>
					<p className="text-muted-foreground">
						Showing {contracts.length} of {total || contracts.length} contracts
					</p>
				</div>

				<div className="bg-card rounded-lg border border-border overflow-hidden">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>ID</TableHead>
									<TableHead>Sender</TableHead>
									<TableHead>Receiver</TableHead>
									<TableHead className="text-right">Amount (SAT)</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="text-right">Funding (SAT)</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Updated</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{contracts.map((contract) => (
									<TableRow
										key={contract.externalId}
										className="hover:bg-muted/50"
									>
										<TableCell>
											<Link
												to={`/admin/backoffice/contracts/${contract.externalId}`}
												className="text-primary hover:underline font-mono text-sm"
											>
												{contract.externalId}
											</Link>
										</TableCell>
										<TableCell className="font-mono text-sm">
											{shortenKey(contract.senderPublicKey)}
										</TableCell>
										<TableCell className="font-mono text-sm">
											{shortenKey(contract.receiverPublicKey)}
										</TableCell>
										<TableCell className="text-right font-mono">
											{contract.amount.toLocaleString()}
										</TableCell>
										<TableCell>
											<StatusBadge status={contract.status} type="contract" />
										</TableCell>
										<TableCell className="max-w-xs truncate">
											{contract.description}
										</TableCell>
										<TableCell className="text-right font-mono">
											{calculateFunding(
												contract.virtualCoins ?? [],
											).toLocaleString()}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{formatDate(contract.createdAt)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{formatDate(contract.updatedAt)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					{loadingMore && (
						<div className="flex justify-center items-center py-8">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							<span className="ml-2 text-muted-foreground">
								Loading more contracts...
							</span>
						</div>
					)}

					{!loading && hasMore && <div ref={observerTarget} className="h-4" />}

					{!loading && !hasMore && contracts.length > 0 && (
						<div className="text-center py-8 text-muted-foreground">
							No more contracts to load
						</div>
					)}
				</div>
			</main>
		</div>
	);
};

export default Contracts;
