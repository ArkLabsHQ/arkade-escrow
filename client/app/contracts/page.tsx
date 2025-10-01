"use client";

import { useCallback, useMemo, useState } from "react";
import { useFetchNextPageQuery } from "./api";
import { shortKey } from "../helpers";
import Header from "../components/Header";

export default function Contracts() {
	return (
		<main className="p-6">
			<Header title="Contracts" />
			<ContractsView />
		</main>
	);
}

function ContractsView() {
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const limit = 20;

	const { data, isLoading, isFetching, error, refetch } = useFetchNextPageQuery(
		{ cursor, limit },
	);

	const items = data?.data ?? [];
	const total = data?.meta.total ?? 0;
	const nextCursor = data?.meta.nextCursor;

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

	// Loading (initial)
	if (isLoading && !data) {
		return (
			<div className="h-dvh flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white">
				<div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md">
					<div className="mx-auto max-w-3xl px-4 pt-6 pb-4">
						<p className="mt-1 text-sm text-slate-500">
							Loading your contracts…
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
						We couldn’t fetch your contracts right now.
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
								{items.length}/{total} loaded{" "}
								{isFetching && (
									<span className="ml-1 text-slate-400">(updating)</span>
								)}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Scrollable content area */}
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-3xl px-4 pb-24">
					{items.length === 0 ? (
						<div className="mt-6 rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
							<div className="mx-auto mb-3 h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center">
								<span className="text-slate-600 text-xl">📭</span>
							</div>
							<h3 className="text-base font-semibold">No contracts</h3>
							<p className="mt-1 text-sm text-slate-500">
								Create or accept a request to see it here.
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
							{items.map((it) => (
								<li
									key={it.externalId}
									className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/50 transition hover:shadow-md"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-3">
											<Avatar />
											<div>
												<div className="flex items-center gap-2">
													<span className="font-medium text-slate-900">
														Contract
													</span>
													<StatusBadge status={it.status} />
												</div>
												<div className="mt-1 text-xs text-slate-500">
													{shortKey(it.externalId)} •{" "}
													{fmtDateTime(it.createdAt)}
												</div>
												<div className="mt-1 text-xs text-slate-500">
													Sender {shortKey(it.senderPublicKey)}
												</div>
												<div className="mt-1 text-xs text-slate-500">
													Receiver {shortKey(it.receiverPublicKey)}
												</div>
												{it.arkAddress && (
													<div className="mt-1 text-[11px] text-slate-500">
														ARK {shortKey(it.arkAddress)}
													</div>
												)}
											</div>
										</div>

										<div className="text-right min-w-[120px]">
											<div className="text-lg font-semibold text-slate-900 tabular-nums">
												{fmtAmount(it.amount)}
											</div>
											<div className="mt-1 text-[11px] text-slate-500">
												Updated {fmtDateTime(it.updatedAt)}
											</div>
										</div>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			{/* Floating controls */}
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
					</div>
				</div>
			</div>
		</div>
	);
}

function StatusBadge(props: { status: string }) {
	const s = props.status;
	const isPositive = ["created", "active", "accepted"].includes(s);
	const cls = isPositive
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

function Avatar() {
	return (
		<div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 p-[2px]">
			<div className="h-full w-full rounded-full bg-white/90 flex items-center justify-center text-[11px] font-semibold text-slate-700">
				ESC
			</div>
		</div>
	);
}
