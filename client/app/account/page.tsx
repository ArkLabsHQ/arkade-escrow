"use client";

import Header from "../components/Header";
import { useEffect, useMemo, useState } from "react";
import {
	useCreateSignupChallengeMutation,
	useVerifySignupChallengeMutation,
} from "./api";
import { shortKey } from "../helpers";
import { useMessageBridge } from "../components/MessageProvider";

export default function Account() {
	const [createSignupChallenge, { isError, isLoading }] =
		useCreateSignupChallengeMutation({
			fixedCacheKey: "create-signup-challenge",
		});
	const [
		verifySignupChallenge,
		{ isError: isVerificationError, isLoading: isVerificationLoading },
	] = useVerifySignupChallengeMutation({
		fixedCacheKey: "verify-signup-challenge",
	});
	const { signChallenge, xPublicKey } = useMessageBridge();

	const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
	const isLoggedIn = useMemo(
		() => sessionStartedAt !== null,
		[sessionStartedAt],
	);

	// Live-updating formatted session duration
	const [now, setNow] = useState<number>(Date.now());
	useEffect(() => {
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, []);
	const sessionDuration = useMemo(() => {
		if (!sessionStartedAt) return "—";
		const diff = Math.max(0, now - sessionStartedAt);
		const s = Math.floor(diff / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (h > 0) return `${h}h ${m}m ${sec}s`;
		if (m > 0) return `${m}m ${sec}s`;
		return `${sec}s`;
	}, [now, sessionStartedAt]);

	// Copy-to-clipboard feedback
	const [copied, setCopied] = useState(false);
	const handleCopy = async () => {
		try {
			// biome-ignore lint/style/noNonNullAssertion: guard is at the button
			await navigator.clipboard.writeText(xPublicKey!);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {
			// noop
		}
	};

	// Handlers
	const handleSignin = async () => {
		try {
			const origin = window.location.origin;
			const res = await createSignupChallenge({
				origin,
				publicKey: xPublicKey!,
			}).unwrap();
			console.log("Signup challenge:", res);
			const signature = await signChallenge(res.hashToSignHex);
			console.log("Signed challenge:", signature);
			const res2 = verifySignupChallenge({
				signature,
				publicKey: xPublicKey!,
				challengeId: res.challengeId,
				origin,
			}).unwrap();
			console.log("Verified challenge:", res);
			// Simulate session being established (for the UI only)
			setSessionStartedAt(Date.now());
		} catch (e) {
			console.error("Failed to create signup challenge", e);
		}
	};
	const handleSignout = () => {
		// Does nothing for now; just reset demo state
		setSessionStartedAt(null);
	};

	return (
		<main className="min-h-dvh flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white">
			{/* Sticky header to mirror the orderbook style */}
			<div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md">
				<div className="mx-auto max-w-3xl px-4 pt-6 pb-3">
					<Header title="Account" />
					<p className="mt-1 text-sm text-slate-500">Manage your session.</p>
				</div>
			</div>

			{/* Scrollable content area */}
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-3xl px-4 pb-24">
					{/* Status card */}
					<div className="mt-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-3">
								<div>
									<div className="flex items-center gap-2">
										<span className="font-medium text-slate-900">Session</span>
										<span
											className={`text-[11px] leading-5 px-2 py-0.5 rounded-full border ${
												isLoggedIn
													? "bg-emerald-50 text-emerald-700 border-emerald-100"
													: "bg-slate-100 text-slate-700 border-slate-200"
											}`}
										>
											{isLoggedIn ? "logged in" : "logged out"}
										</span>
									</div>
									<div className="mt-1 text-xs text-slate-500">
										Duration: {sessionDuration}
									</div>
								</div>
							</div>
						</div>

						{isError && (
							<p className="mt-3 text-sm text-red-600">
								We couldn’t start a sign-in challenge. Please try again.
							</p>
						)}

						{/* Public key row */}
						<div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<div className="text-xs text-slate-500">Your public key</div>
									<div className="mt-0.5 font-mono text-sm text-slate-800 select-none">
										{xPublicKey ? shortKey(xPublicKey) : "-"}
									</div>
								</div>
								<button
									type="button"
									onClick={handleCopy}
									className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white border border-slate-200"
									title="Copy public key"
								>
									{copied ? "Copied" : "Copy"}
								</button>
							</div>
						</div>

						<div className="mt-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
							<div className="flex items-center justify-around gap-2">
								<button
									type="button"
									onClick={handleSignin}
									disabled={isLoading}
									className={`rounded-full px-4 py-2 text-sm font-medium transition active:scale-[0.98] ${
										isLoading
											? "bg-slate-100 text-slate-400 cursor-not-allowed"
											: "bg-slate-900 text-white"
									}`}
								>
									{isLoading ? "Signing in…" : "Sign in"}
								</button>
								<button
									type="button"
									onClick={handleSignout}
									className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
								>
									Sign out
								</button>
							</div>
						</div>
					</div>

					{/* Hint card */}
					<div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600">
						- Sign in triggers the signup challenge request and logs the
						response to the console.
						<br />- Public key is shortened and clickable to copy.
						<br />- Sign out is a placeholder.
					</div>
				</div>
			</div>
		</main>
	);
}
