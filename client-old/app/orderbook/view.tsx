"use client";

import { useState, useMemo, useCallback } from "react";
import { useFetchNextPageQuery } from "./api";
import ButtonIcon from "../components/ButtonIcon";
import { IconUserOff } from "@tabler/icons-react";
import AccountBadge from "../components/AccountBadge";
import { printMyPubKey, shortKey } from "../helpers";
import { useCreateFromRequestMutation } from "../contracts/api";
import { selectXPublicKey } from "../account/api";
import { useAppSelector } from "../hooks";
import { useMessageBridge } from "../components/MessageProvider";
import { useRouter } from "next/navigation";

export default function Orderbook() {
	const router = useRouter();
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const limit = 20;

	const { data, isLoading, isFetching, error, refetch } = useFetchNextPageQuery(
		{ cursor, limit },
	);

	const [
		createContract,
		{ isError: isContractCreationError, isLoading: isContractCreationLoading },
	] = useCreateFromRequestMutation();

	const { xPublicKey } = useMessageBridge();

	const items = data?.data ?? [];
	const total = data?.meta.total ?? 0;
	const nextCursor = data?.meta.nextCursor;

	// Filters (client-side) similar to Revolut pill filters
	const [statusFilter, setStatusFilter] = useState<
		"all" | "open" | "cancelled"
	>("all");
	const [sideFilter, setSideFilter] = useState<"all" | "sender" | "receiver">(
		"all",
	);

	const filteredItems = useMemo(() => {
		return items.filter((it) => {
			const statusOk =
				statusFilter === "all" ? true : it.status === statusFilter;
			const sideOk = sideFilter === "all" ? true : it.side === sideFilter;
			return statusOk && sideOk;
		});
	}, [items, statusFilter, sideFilter]);

	const canLoadMore = useMemo(
		() => Boolean(nextCursor) && !isFetching,
		[nextCursor, isFetching],
	);

	const handleLoadMore = useCallback(() => {
		if (nextCursor) setCursor(nextCursor);
	}, [nextCursor]);

	const fmtAmount = (n?: number) =>
		typeof n === "number"
			? new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(n)
			: "—";
	const fmtDateTime = (ms: number) =>
		new Date(ms).toLocaleString(undefined, {
			year: "2-digit",
			month: "short",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});

	// Loading (initial) — skeleton cards
	if (isLoading && !data) {
		return (
			<div className="h-dvh flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white">
				<div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md">
					<div className="mx-auto max-w-3xl px-4 pt-6 pb-4">
						<p className="mt-1 text-sm text-slate-500">
							Loading your latest requests…
						</p>
					</div>
				</div>
				<div className="flex-1 overflow-y-auto">
					<div className="mx-auto max-w-3xl px-4 py-4 space-y-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/50"
							>
								<div className="flex items-center gap-3">
									<div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" />
									<div className="flex-1">
										<div className="h-4 w-1/3 rounded bg-slate-200 animate-pulse" />
										<div className="mt-2 h-3 w-2/3 rounded bg-slate-200 animate-pulse" />
									</div>
									<div className="h-5 w-16 rounded-full bg-slate-200 animate-pulse" />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="h-dvh flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
				<div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
					<div className="mx-auto mb-3 h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
						<span className="text-red-600 text-xl">!</span>
					</div>
					<h2 className="text-lg font-semibold text-red-700">Failed to load</h2>
					<p className="mt-1 text-sm text-red-600">
						We couldn’t fetch your orderbook right now.
					</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-white transition active:scale-[0.98]"
					>
						Try again
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="h-dvh flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white">
			{/* Sticky header */}
			<div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md">
				<div className="mx-auto max-w-3xl px-4 pt-6 pb-3">
					<div className="flex items-center justify-between">
						<div>
							<p className="mt-0.5 text-sm text-slate-500">
								{filteredItems.length}/{total} loaded{" "}
								{isFetching && (
									<span className="ml-1 text-slate-400">(updating)</span>
								)}
							</p>
						</div>
					</div>

					{/* Filters */}
					<div className="mt-3 flex items-center gap-2">
						<Pill
							active={statusFilter === "all"}
							onClick={() => setStatusFilter("all")}
							label="All"
						/>
						<Pill
							active={statusFilter === "open"}
							onClick={() => setStatusFilter("open")}
							label="Open"
						/>
						<Pill
							active={statusFilter === "cancelled"}
							onClick={() => setStatusFilter("cancelled")}
							label="Cancelled"
						/>

						<div className="mx-2 h-5 w-px bg-slate-200" />

						<Pill
							active={sideFilter === "all"}
							onClick={() => setSideFilter("all")}
							label="All sides"
						/>
						<Pill
							active={sideFilter === "sender"}
							onClick={() => setSideFilter("sender")}
							label="Sender"
						/>
						<Pill
							active={sideFilter === "receiver"}
							onClick={() => setSideFilter("receiver")}
							label="Receiver"
						/>
					</div>
				</div>
			</div>

			{/* Scrollable content area */}
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-3xl px-4 pb-24">
					{filteredItems.length === 0 ? (
						<div className="mt-6 rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
							<div className="mx-auto mb-3 h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center">
								<span className="text-slate-600 text-xl">📭</span>
							</div>
							<h3 className="text-base font-semibold">No requests</h3>
							<p className="mt-1 text-sm text-slate-500">
								Try adjusting the filters or refresh to see new activity.
							</p>
							<button
								type="button"
								onClick={() => refetch()}
								className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-white transition active:scale-[0.98]"
							>
								Refresh
							</button>
						</div>
					) : (
						<ul className="mt-3 space-y-3">
							{filteredItems.map((it) => (
								<li
									key={it.externalId}
									className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/50 transition hover:shadow-md"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-3">
											<Avatar side={it.side} />
											<div>
												<div className="flex items-center gap-2">
													<span className="font-medium text-slate-900">
														{it.description || "Request"}
													</span>
													<StatusBadge status={it.status} />
												</div>
												<div className="mt-1 text-xs text-slate-500">
													{shortKey(it.externalId)} •{" "}
													{fmtDateTime(it.createdAt)}
												</div>
												<div className="mt-1 text-xs text-slate-500">
													By {printMyPubKey(xPublicKey, it.creatorPublicKey)}
												</div>
											</div>
										</div>

										<div className="text-right min-w-[120px]">
											<div className="text-lg font-semibold text-slate-900 tabular-nums">
												{fmtAmount(it.amount)}
											</div>
											<div className="mt-1">
												<span
													className={
														it.side === "sender"
															? "text-emerald-600 text-xs bg-emerald-50 rounded-full px-2 py-0.5"
															: "text-indigo-600 text-xs bg-indigo-50 rounded-full px-2 py-0.5"
													}
												>
													{it.side}
												</span>
											</div>

											<button
												type="button"
												className="mt-4 h-8 w-full rounded-full bg-slate-200 animate-pulse"
												onClick={() =>
													createContract({ requestId: it.externalId })
														.then((a) => {
															console.log("Contract created successfully", a);
														})
														.catch((e) => {
															console.error("Failed to create contract", e);
														})
												}
											>
												CREATE
											</button>
										</div>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			{/* Floating controls (outside scroll area) */}
			<div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">
				<div className="pointer-events-auto w-full max-w-3xl">
					<div className="rounded-full border border-slate-200 bg-white p-1.5 shadow-md shadow-slate-200/60 flex gap-2">
						<button
							type="button"
							onClick={handleLoadMore}
							disabled={!canLoadMore}
							className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition active:scale-[0.99] ${
								canLoadMore
									? "bg-slate-900 text-white"
									: "bg-slate-100 text-slate-400 cursor-not-allowed"
							}`}
						>
							{isFetching ? "Loading…" : nextCursor ? "Load more" : "No more"}
						</button>
						<button
							type="button"
							onClick={() => refetch()}
							className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
						>
							Refresh
						</button>
						<button
							type="button"
							onClick={() => router.push("/orderbook/new-request")}
							className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
						>
							New Request
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function Pill(props: { active: boolean; onClick: () => void; label: string }) {
	return (
		<button
			type="button"
			onClick={props.onClick}
			className={`rounded-full px-3 py-1.5 text-sm transition active:scale-[0.98] ${
				props.active
					? "bg-slate-900 text-white"
					: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
			}`}
		>
			{props.label}
		</button>
	);
}

function StatusBadge(props: { status: "open" | "cancelled" }) {
	const s = props.status;
	const cls =
		s === "open"
			? "bg-emerald-50 text-emerald-700 border-emerald-100"
			: "bg-slate-100 text-slate-700 border-slate-200";
	return (
		<span
			className={`text-[11px] leading-5 px-2 py-0.5 rounded-full border ${cls}`}
		>
			{s}
		</span>
	);
}

function Avatar(props: { side: "sender" | "receiver" }) {
	const isSender = props.side === "sender";
	const gradient = isSender
		? "from-emerald-400 via-emerald-500 to-emerald-600"
		: "from-indigo-400 via-indigo-500 to-indigo-600";
	return (
		<div
			className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradient} p-[2px]`}
		>
			<div className="h-full w-full rounded-full bg-white/90 flex items-center justify-center text-[11px] font-semibold text-slate-700">
				{isSender ? "SND" : "RCV"}
			</div>
		</div>
	);
}
