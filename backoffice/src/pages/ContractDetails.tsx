import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import ContractTimeline from "@/components/ContractTimeline";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import Config from "@/Config.ts";

interface Contract {
	externalId: string;
	requestId: string;
	senderPublicKey: string;
	receiverPublicKey: string;
	amount: number;
	arkAddress?: string;
	status: string;
	side: string;
	description: string;
	cancelationReason: string;
	virtualCoins: Array<{
		txid: string;
		vout: number;
		value: number;
		createdAt: string;
	}>;
	executions: Array<{
		externalId: string;
		initiatedByPubKey: string;
		status: string;
		rejectionReason: string | null;
		cancelationReason: string | null;
		transaction: any;
		createdAt: number;
		updatedAt: number;
	}>;
	arbitrations: Array<{
		externalId: string;
		contractId: string;
		claimantPublicKey: string;
		defendantPublicKey: string;
		reason: string;
		status: string;
		createdAt: number;
		updatedAt: number;
	}>;
	createdAt: number;
	updatedAt: number;
	acceptedAt: number | null;
	canceledAt: number | null;
}

const ContractDetails = () => {
	const { externalId } = useParams();
	const [contract, setContract] = useState<Contract | null>(null);
	const [loading, setLoading] = useState(true);
	const [executionsOpen, setExecutionsOpen] = useState(false);
	const [disputesOpen, setDisputesOpen] = useState(true);

	const fetchContract = useCallback(async () => {
		try {
			const response = await fetch(
				`${Config.apiBaseUrl}/admin/v1/contracts/${externalId}`,
			);
			const result = await response.json();
			setContract(result.data);
		} catch (error) {
			toast.error("Failed to fetch contract details");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [externalId]);

	useEffect(() => {
		fetchContract();
	}, [fetchContract]);

	// SSE listener for contract updates
	useEffect(() => {
		const eventSource = new EventSource(
			"${Config.apiBaseUrl}/admin/v1/contracts/sse",
		);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				fetchContract();
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
	}, [fetchContract]);

	const handleArbitration = async (
		disputeId: string,
		action: "settle" | "refund",
	) => {
		try {
			const response = await fetch(
				`${Config.apiBaseUrl}/admin/v1/contracts/${externalId}/arbitrate`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ disputeId, action }),
				},
			);

			if (!response.ok) throw new Error("Arbitration failed");

			toast.success(
				`Dispute ${action === "settle" ? "settled" : "refunded"} successfully`,
			);
			fetchContract();
		} catch (error) {
			toast.error(`Failed to ${action} dispute`);
			console.error(error);
		}
	};

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

	const buildTimeline = (contract: Contract) => {
		const events = [];

		events.push({
			label: "Contract created",
			timestamp: contract.createdAt,
			type: "created" as const,
		});

		if (contract.acceptedAt) {
			events.push({
				label: "Contract accepted",
				timestamp: contract.acceptedAt,
				type: "accepted" as const,
			});
		}

		if (contract.canceledAt) {
			events.push({
				label: `Contract ${contract.status.includes("canceled") ? "canceled" : "rejected"}`,
				timestamp: contract.canceledAt,
				type: "canceled" as const,
			});
		}

		contract.virtualCoins?.forEach((coin, index) => {
			events.push({
				label: `Funded: ${coin.value} SAT`,
				timestamp: new Date(coin.createdAt).getTime(),
				type: "funded" as const,
			});
		});

		contract.executions?.forEach((exec) => {
			events.push({
				label: `Execution ${exec.externalId} initiated`,
				timestamp: exec.createdAt,
				type: "execution" as const,
			});
			if (exec.updatedAt !== exec.createdAt) {
				events.push({
					label: `Execution ${exec.externalId} updated`,
					timestamp: exec.updatedAt,
					type: "execution" as const,
				});
			}
		});

		if (contract.status === "completed") {
			events.push({
				label: "Contract completed",
				timestamp: contract.updatedAt,
				type: "completed" as const,
			});
		}

		if (contract.status === "under-arbitration") {
			events.push({
				label: "Contract disputed",
				timestamp: contract.updatedAt,
				type: "disputed" as const,
			});
		}

		return events;
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-background">
				<Header />
				<main className="container mx-auto px-6 py-8">
					<p className="text-muted-foreground">Loading contract...</p>
				</main>
			</div>
		);
	}

	if (!contract) {
		return (
			<div className="min-h-screen bg-background">
				<Header />
				<main className="container mx-auto px-6 py-8">
					<p className="text-destructive">Contract not found</p>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="container mx-auto px-6 py-8">
				<Link
					to="/backoffice/contracts"
					className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
				>
					<ArrowLeft size={20} />
					<span>Back to Contracts</span>
				</Link>
				<div className="mb-6">
					<h2 className="text-3xl font-bold text-foreground mb-2">
						Contract Details
					</h2>
					<p className="text-muted-foreground font-mono">
						{contract.externalId}
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
					{/* Timeline */}
					<div className="lg:col-span-1">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Timeline</CardTitle>
							</CardHeader>
							<CardContent>
								<ContractTimeline events={buildTimeline(contract)} />
							</CardContent>
						</Card>
					</div>

					{/* Main content */}
					<div className="lg:col-span-3 space-y-6">
						{/* Basic Info */}
						<Card>
							<CardHeader>
								<CardTitle>Basic Information</CardTitle>
							</CardHeader>
							<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">External ID</p>
									<p className="font-mono text-sm">{contract.externalId}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Request ID</p>
									<p className="font-mono text-sm">{contract.requestId}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									<div className="mt-1">
										<StatusBadge status={contract.status} type="contract" />
									</div>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Side</p>
									<p className="font-medium">{contract.side}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Amount</p>
									<p className="font-mono">
										{contract.amount.toLocaleString()} SAT
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Funding</p>
									<p className="font-mono">
										{calculateFunding(
											contract.virtualCoins ?? [],
										).toLocaleString()}{" "}
										SAT
									</p>
								</div>
								<div className="md:col-span-2">
									<p className="text-sm text-muted-foreground">Description</p>
									<p className="font-medium">{contract.description}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Sender</p>
									<p className="font-mono text-sm">
										{shortenKey(contract.senderPublicKey)}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Receiver</p>
									<p className="font-mono text-sm">
										{shortenKey(contract.receiverPublicKey)}
									</p>
								</div>
								<div className="md:col-span-2">
									<p className="text-sm text-muted-foreground">ARK Address</p>
									<p className="font-mono text-xs break-all">
										{contract.arkAddress ?? "-"}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Created</p>
									<p className="text-sm">{formatDate(contract.createdAt)}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Updated</p>
									<p className="text-sm">{formatDate(contract.updatedAt)}</p>
								</div>
								{contract.acceptedAt && (
									<div>
										<p className="text-sm text-muted-foreground">Accepted</p>
										<p className="text-sm">{formatDate(contract.acceptedAt)}</p>
									</div>
								)}
								{contract.canceledAt && (
									<div>
										<p className="text-sm text-muted-foreground">Canceled</p>
										<p className="text-sm">{formatDate(contract.canceledAt)}</p>
									</div>
								)}
								{contract.cancelationReason && (
									<div className="md:col-span-2">
										<p className="text-sm text-muted-foreground">
											Cancelation Reason
										</p>
										<p className="text-sm">{contract.cancelationReason}</p>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Virtual Coins */}
						<Card>
							<CardHeader>
								<CardTitle>
									Virtual Coins ({contract.virtualCoins.length})
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{contract.virtualCoins.map((coin, index) => (
										<div key={index} className="p-3 bg-muted/50 rounded-lg">
											<div className="grid grid-cols-2 gap-2 text-sm">
												<div>
													<span className="text-muted-foreground">TXID:</span>
													<p className="font-mono text-xs break-all">
														{coin.txid}
													</p>
												</div>
												<div>
													<span className="text-muted-foreground">Value:</span>
													<p className="font-mono">
														{coin.value.toLocaleString()} SAT
													</p>
												</div>
												<div>
													<span className="text-muted-foreground">Vout:</span>
													<p className="font-mono">{coin.vout}</p>
												</div>
												<div>
													<span className="text-muted-foreground">
														Created:
													</span>
													<p className="text-xs">
														{new Date(coin.createdAt).toLocaleString()}
													</p>
												</div>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						{/* Executions */}
						{contract.executions?.length > 0 && (
							<Collapsible
								open={executionsOpen}
								onOpenChange={setExecutionsOpen}
							>
								<Card>
									<CardHeader>
										<CollapsibleTrigger className="flex w-full items-center justify-between">
											<CardTitle>
												Executions ({contract.executions.length})
											</CardTitle>
											{executionsOpen ? (
												<ChevronUp className="h-5 w-5" />
											) : (
												<ChevronDown className="h-5 w-5" />
											)}
										</CollapsibleTrigger>
									</CardHeader>
									<CollapsibleContent>
										<CardContent className="space-y-4">
											{contract.executions.map((exec, index) => (
												<div
													key={index}
													className="p-4 bg-muted/50 rounded-lg space-y-3"
												>
													<div className="grid grid-cols-2 gap-3">
														<div>
															<p className="text-sm text-muted-foreground">
																External ID
															</p>
															<p className="font-mono text-sm">
																{exec.externalId}
															</p>
														</div>
														<div>
															<p className="text-sm text-muted-foreground">
																Status
															</p>
															<StatusBadge
																status={exec.status}
																type="execution"
															/>
														</div>
														<div>
															<p className="text-sm text-muted-foreground">
																Initiated By
															</p>
															<p className="font-mono text-xs">
																{shortenKey(exec.initiatedByPubKey)}
															</p>
														</div>
														<div>
															<p className="text-sm text-muted-foreground">
																Created
															</p>
															<p className="text-sm">
																{formatDate(exec.createdAt)}
															</p>
														</div>
													</div>
													{exec.transaction && (
														<div>
															<p className="text-sm text-muted-foreground mb-2">
																Transaction
															</p>
															<pre className="bg-background p-3 rounded text-xs overflow-auto max-h-64">
																{JSON.stringify(exec.transaction, null, 2)}
															</pre>
														</div>
													)}
												</div>
											))}
										</CardContent>
									</CollapsibleContent>
								</Card>
							</Collapsible>
						)}

						{/* Disputes */}
						{contract.arbitrations.length > 0 && (
							<Collapsible open={disputesOpen} onOpenChange={setDisputesOpen}>
								<Card>
									<CardHeader>
										<CollapsibleTrigger className="flex w-full items-center justify-between">
											<CardTitle>
												Disputes ({contract.arbitrations.length})
											</CardTitle>
											{disputesOpen ? (
												<ChevronUp className="h-5 w-5" />
											) : (
												<ChevronDown className="h-5 w-5" />
											)}
										</CollapsibleTrigger>
									</CardHeader>
									<CollapsibleContent>
										<CardContent className="space-y-4">
											{contract.arbitrations.map((dispute) => (
												<div
													key={dispute.externalId}
													className="p-4 bg-muted/50 rounded-lg space-y-3"
												>
													<div className="grid grid-cols-2 gap-3">
														<div>
															<p className="text-sm text-muted-foreground">
																Dispute ID
															</p>
															<p className="font-mono text-sm">
																{dispute.externalId}
															</p>
														</div>
														<div>
															<p className="text-sm text-muted-foreground">
																Status
															</p>
															<StatusBadge
																status={dispute.status}
																type="dispute"
															/>
														</div>
														<div className="col-span-2">
															<p className="text-sm text-muted-foreground">
																Claimant
															</p>
															<p className="font-mono text-xs">
																{shortenKey(dispute.claimantPublicKey)}
															</p>
														</div>
														<div className="col-span-2">
															<p className="text-sm text-muted-foreground">
																Reason
															</p>
															<p className="text-sm">{dispute.reason}</p>
														</div>
														<div>
															<p className="text-sm text-muted-foreground">
																Created
															</p>
															<p className="text-sm">
																{formatDate(dispute.createdAt)}
															</p>
														</div>
														<div>
															<p className="text-sm text-muted-foreground">
																Updated
															</p>
															<p className="text-sm">
																{formatDate(dispute.updatedAt)}
															</p>
														</div>
													</div>
													{dispute.status === "pending" && (
														<div className="flex gap-3 mt-4">
															<Button
																onClick={() =>
																	handleArbitration(
																		dispute.externalId,
																		"settle",
																	)
																}
																variant="default"
															>
																Settle
															</Button>
															<Button
																onClick={() =>
																	handleArbitration(
																		dispute.externalId,
																		"refund",
																	)
																}
																variant="destructive"
															>
																Refund
															</Button>
														</div>
													)}
												</div>
											))}
										</CardContent>
									</CollapsibleContent>
								</Card>
							</Collapsible>
						)}
					</div>
				</div>
			</main>
		</div>
	);
};

export default ContractDetails;
