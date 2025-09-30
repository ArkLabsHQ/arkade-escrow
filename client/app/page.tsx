"use client";

import { useMemo } from "react";
import { ArkadeIframeHost } from "../components/ArkadeIframeHost";
import type { ArkadeIdentityHandlers } from "../components/ArkadeIframeHost";
import { mockHandlers } from "../lib/mockWallet";

function parseAllowedOrigins(
	src: string,
	envList: string | undefined,
): string[] {
	const list = (envList ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (list.length > 0) return list;
	try {
		const origin = new URL(src).origin;
		return [origin];
	} catch {
		return [];
	}
}

export default function Page() {
	const iframeSrc =
		process.env.NEXT_PUBLIC_ESCROW_IFRAME_SRC ??
		"http://localhost:3000/mock-iframe.html";
	const allowed = parseAllowedOrigins(
		iframeSrc,
		process.env.NEXT_PUBLIC_ALLOWED_CHILD_ORIGINS,
	);

	const handlers: ArkadeIdentityHandlers = useMemo(
		() => ({
			...mockHandlers,
		}),
		[],
	);

	return (
		<main className="mx-auto max-w-4xl p-6">
			<header className="mb-6">
				<h1 className="text-3xl font-bold tracking-tight">
					Ark Escrow — Wallet Host
				</h1>
				<p className="mt-2 text-slate-600">
					This page embeds the escrow UI in an iframe and exposes wallet RPC
					methods via <code>postMessage</code>.
				</p>
			</header>

			<section className="space-y-4">
				<div className="rounded-2xl border border-slate-200 p-4">
					<h2 className="mb-2 text-xl font-semibold">Embedded Escrow Iframe</h2>
					<p className="mb-4 text-sm text-slate-600">
						<span className="font-mono">src</span>:{" "}
						<span className="font-mono">{iframeSrc}</span>
						<br />
						<span className="font-mono">allowed origins</span>:{" "}
						<span className="font-mono">{allowed.join(", ") || "(none)"}</span>
					</p>

					<ArkadeIframeHost
						src={iframeSrc}
						allowedChildOrigins={allowed}
						handlers={handlers}
						className="w-full"
						autoHeight
						minHeight={420}
					/>
				</div>

				<div className="rounded-2xl border border-slate-200 p-4">
					<h3 className="mb-2 text-lg font-semibold">
						How to wire real wallet handlers
					</h3>
					<ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1">
						<li>
							Replace <code>mockHandlers</code> in{" "}
							<code>lib/mockWallet.ts</code> with calls to your wallet SDK.
						</li>
						<li>
							Set <code>NEXT_PUBLIC_ESCROW_IFRAME_SRC</code> in{" "}
							<code>.env.local</code> to your escrow UI URL.
						</li>
						<li>
							Optionally set <code>NEXT_PUBLIC_ALLOWED_CHILD_ORIGINS</code>{" "}
							(comma-separated). If omitted, it will be derived from the iframe{" "}
							<code>src</code>.
						</li>
					</ol>
				</div>
			</section>
		</main>
	);
}
