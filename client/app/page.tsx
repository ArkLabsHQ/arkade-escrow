"use client";

export default function Page() {
	return (
		<main className="mx-auto max-w-4xl p-6">
			<header className="mb-6">
				<h1 className="text-3xl font-bold tracking-tight">Ark Escrow</h1>
				<p className="mt-2 text-slate-600">
					This page embeds the escrow UI in an iframe and exposes wallet RPC
					methods via <code>postMessage</code>.
				</p>
			</header>

			<section className="space-y-4">
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
