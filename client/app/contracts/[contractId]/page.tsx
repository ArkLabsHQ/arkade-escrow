"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
	ContractDto,
	Transaction,
	useGetContractByIdQuery,
	useSignContractExecutionMutation,
} from "../api";
import { useGetRequestByIdQuery } from "../../orderbook/api";
import { useMessageBridge } from "../../components/MessageProvider";
import { printMyPubKey } from "../../helpers";
import Header from "../../components/Header";

// Lightweight UI primitives aligned with our existing look & feel
function Badge({
	children,
	tone = "default",
}: {
	children: React.ReactNode;
	tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
	const tones: Record<string, string> = {
		default:
			"bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200",
		success:
			"bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
		warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
		danger: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
		info: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
	};
	return (
		<span
			className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
		>
			{children}
		</span>
	);
}

function Field({
	label,
	children,
	mono = false,
	copy = false,
}: {
	label: string;
	children?: React.ReactNode;
	mono?: boolean;
	copy?: boolean;
}) {
	const value =
		typeof children === "string" || typeof children === "number"
			? String(children)
			: undefined;
	const handleCopy = async () => {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
		} catch {}
	};
	return (
		<div className="min-w-0">
			<div className="text-xs font-medium text-neutral-500">{label}</div>
			<div className="mt-1 flex items-center gap-2">
				<div
					className={`min-w-0 break-all ${
						mono ? "font-mono text-[13px] tracking-tight" : ""
					}`}
				>
					{children ?? <span className="text-neutral-400">—</span>}
				</div>
				{copy && value && (
					<button
						type="button"
						onClick={handleCopy}
						className="shrink-0 rounded-md px-2 py-1 text-xs text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50"
						aria-label={`Copy ${label}`}
						title={`Copy ${label}`}
					>
						Copy
					</button>
				)}
			</div>
		</div>
	);
}

function Section({
	title,
	subtitle,
	right,
	children,
}: {
	title: string;
	subtitle?: string;
	right?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
			<div className="mb-3 flex items-start justify-between gap-3">
				<div>
					<h2 className="text-base font-semibold">{title}</h2>
					{subtitle ? (
						<p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
					) : null}
				</div>
				{right}
			</div>
			{children}
		</section>
	);
}

export default function Page() {
	const params = useParams<{ contractId: string }>();
	const contractId = params?.contractId;

	const {
		data: contract,
		isLoading,
		isFetching,
		isError,
		error,
		refetch,
	} = useGetContractByIdQuery(contractId!, {
		skip: !contractId,
	});

	const { data: escrowRequest } = useGetRequestByIdQuery(
		contract?.requestId ?? "no-contract",
		{
			skip: !contract,
		},
	);

	const [signContractExecution] = useSignContractExecutionMutation();

	const { xPublicKey, walletAddress, signTransaction } = useMessageBridge();

	const title = `Contract ${contractId ?? ""}`;

	async function signExecutionTransaction(
		executionId: string,
		transaction: Transaction,
	) {
		console.log("handler 1");
		const signed = await signTransaction(transaction);
		console.log("handler 2");
		await signContractExecution({
			contractId: contractId!,
			executionId,
			arkTx: signed.tx,
			checkpoints: signed.checkpoints,
		});
		console.log("done?");
	}

	const statusTone = (
		status?: string,
	): "default" | "success" | "warning" | "danger" | "info" => {
		const s = (status ?? "").toLowerCase();
		if (["active", "confirmed", "executed", "success", "ok"].includes(s))
			return "success";
		if (["pending", "processing", "queued"].includes(s)) return "warning";
		if (["failed", "error", "canceled", "reverted"].includes(s))
			return "danger";
		if (["draft", "created"].includes(s)) return "info";
		return "default";
	};

	return (
		<div className="mx-auto w-full max-w-4xl px-4 py-6 md:py-8">
			<Header title={title} />

			{(isLoading || (!contract && isFetching)) && (
				<div className="space-y-4">
					<div className="animate-pulse rounded-xl border border-neutral-200 bg-white/40 p-4">
						<div className="h-5 w-40 rounded bg-neutral-200" />
						<div className="mt-4 h-4 w-full rounded bg-neutral-200" />
						<div className="mt-2 h-4 w-5/6 rounded bg-neutral-200" />
						<div className="mt-2 h-4 w-4/6 rounded bg-neutral-200" />
					</div>
					<div className="animate-pulse rounded-xl border border-neutral-200 bg-white/40 p-4">
						<div className="h-5 w-56 rounded bg-neutral-200" />
						<div className="mt-4 h-4 w-full rounded bg-neutral-200" />
						<div className="mt-2 h-4 w-3/4 rounded bg-neutral-200" />
					</div>
				</div>
			)}

			{isError && (
				<div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="font-medium text-rose-700">
								Couldn’t load contract
							</p>
							<p className="mt-1 text-sm text-rose-600">
								{(() => {
									const e = error as any;
									return (
										e?.message ||
										e?.error ||
										(typeof e?.data === "string" ? e.data : undefined) ||
										"Please try again."
									);
								})()}
							</p>
						</div>
						<button
							onClick={() => refetch()}
							className="inline-flex items-center rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black/85"
						>
							Retry
						</button>
					</div>
				</div>
			)}

			{contract && (
				<div className="space-y-6">
					<Section
						title="Contract"
						right={
							<div className="text-xs text-neutral-500">
								{isFetching ? "Refreshing…" : "Up to date"}
							</div>
						}
					>
						<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
							<Field label="Contract ID" mono copy>
								{contractId}
							</Field>

							<div>
								<div className="text-xs font-medium text-neutral-500">
									Status
								</div>
								<div className="mt-1">
									<Badge tone={statusTone(contract.status)}>
										{contract.status ?? "unknown"}
									</Badge>
								</div>
							</div>

							<Field label="Side">
								<div className="flex items-center gap-2">
									<Badge
										tone={
											(escrowRequest?.side ?? "").toLowerCase() === "buy"
												? "info"
												: "warning"
										}
									>
										{escrowRequest?.side ?? "—"}
									</Badge>
								</div>
							</Field>

							<Field label="Amount">
								{typeof contract.amount === "number"
									? Intl.NumberFormat(undefined, {
											maximumFractionDigits: 8,
										}).format(contract.amount)
									: (contract.amount ?? "—")}
							</Field>

							<Field label="ARK Address" mono copy>
								{contract.arkAddress}
							</Field>

							<Field label="Sender Public key" mono copy>
								{printMyPubKey(xPublicKey, contract.senderPublicKey)}
							</Field>

							<Field label="Receiver Public key" mono copy>
								{printMyPubKey(xPublicKey, contract.receiverPublicKey)}
							</Field>

							<Field label="Created at">
								{contract.createdAt
									? new Date(contract.createdAt).toLocaleString()
									: "—"}
							</Field>

							<Field label="Updated at">
								{contract.updatedAt
									? new Date(contract.updatedAt).toLocaleString()
									: "—"}
							</Field>
						</div>

						{/* Virtual coins collapsible */}
						<div className="mt-6">
							<details className="group">
								<summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50">
									<span className="text-sm font-medium text-neutral-700">
										Virtual coins
									</span>
									<span className="text-xs text-neutral-500 group-open:hidden">
										Show
									</span>
									<span className="hidden text-xs text-neutral-500 group-open:inline">
										Hide
									</span>
								</summary>
								<div className="mt-3 space-y-3">
									{(Array.isArray(contract.virtualCoins)
										? contract.virtualCoins
										: []
									).map((vc, idx) => (
										<pre
											key={idx}
											className="overflow-auto rounded-lg bg-neutral-50 p-3 text-[13px] leading-6 text-neutral-800 ring-1 ring-inset ring-neutral-200"
										>
											{JSON.stringify(vc, null, 2)}
										</pre>
									))}
									{(!Array.isArray(contract.virtualCoins) ||
										contract.virtualCoins?.length === 0) && (
										<div className="text-sm text-neutral-500 px-1">
											No virtual coins
										</div>
									)}
								</div>
							</details>
						</div>
					</Section>

					{/* Last transaction section */}
					{contract.lastExecution && (
						<Section
							title="Last execution"
							subtitle="Most recent execution activity related to this contract"
						>
							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<Field label="ID" mono copy>
									{contract.lastExecution.externalId}
								</Field>
								<div>
									<div className="text-xs font-medium text-neutral-500">
										Status
									</div>
									<div className="mt-1">
										<Badge
											tone={statusTone((contract.lastExecution as any).status)}
										>
											{contract.lastExecution.status}
										</Badge>
									</div>
								</div>
								<div>
									<div className="text-xs font-medium text-neutral-500">
										Action
									</div>
									<div className="mt-1">
										<Badge
											tone={statusTone((contract.lastExecution as any).status)}
										>
											{contract.lastExecution.action}
										</Badge>
									</div>
								</div>
								<Field label="Initiated by" mono copy>
									{printMyPubKey(
										xPublicKey,
										contract.lastExecution.initiatedByPubKey,
									)}
								</Field>
								<Field label="Timestamp">
									{(() => {
										const ts =
											(contract.lastExecution as any).timestamp ??
											(contract.lastExecution as any).time;
										if (!ts) return "—";
										const n = typeof ts === "number" ? ts : Number(ts);
										const d = n > 1e12 ? new Date(n) : new Date(n * 1000); // try seconds
										return isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
									})()}
								</Field>
								{contract.lastExecution && (
									<button
										type={"button"}
										onClick={() =>
											signExecutionTransaction(
												contract.lastExecution.externalId,
												contract.lastExecution.transaction,
											)
										}
									>
										Sign transaction
									</button>
								)}
							</div>

							{/* Raw fallback for other fields */}
							<div className="mt-4">
								<details className="group">
									<summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50">
										<span className="text-sm font-medium text-neutral-700">
											Raw execution data
										</span>
										<span className="text-xs text-neutral-500 group-open:hidden">
											Show
										</span>
										<span className="hidden text-xs text-neutral-500 group-open:inline">
											Hide
										</span>
									</summary>
									<pre className="mt-3 overflow-auto rounded-lg bg-neutral-50 p-3 text-[13px] leading-6 text-neutral-800 ring-1 ring-inset ring-neutral-200">
										{JSON.stringify(contract.lastExecution, null, 2)}
									</pre>
								</details>
							</div>
						</Section>
					)}
				</div>
			)}
		</div>
	);
}
