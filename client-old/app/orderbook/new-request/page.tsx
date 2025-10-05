"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import { useCreateRequestMutation } from "../api";

type Side = "sender" | "receiver";

export default function NewEscrowRequestPage() {
	const router = useRouter();

	const [side, setSide] = useState<Side>("receiver");
	const [amount, setAmount] = useState<string>("");
	const [description, setDescription] = useState<string>("");
	const [isPublic, setIsPublic] = useState<boolean>(true);

	const [
		createRequest,
		{ isError: isCreateRequestError, isLoading: isCreateRequestLoading },
	] = useCreateRequestMutation();

	const [errors, setErrors] = useState<{
		amount?: string;
		description?: string;
	}>({});

	function validate() {
		const nextErrors: typeof errors = {};
		const intAmount = Number(amount);

		if (!amount || Number.isNaN(intAmount)) {
			nextErrors.amount = "Please enter an amount in SAT.";
		} else if (!Number.isInteger(intAmount) || intAmount <= 0) {
			nextErrors.amount = "Amount must be a positive integer (in SAT).";
		}

		if (description.length > 255) {
			nextErrors.description = "Description must be at most 255 characters.";
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	}

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (!validate()) return;

		const payload = {
			side,
			amount: Number(amount),
			description: description.trim(),
			public: isPublic,
		};

		const res = await createRequest(payload).unwrap();
		router.back();
		console.log("New Escrow Request:", res);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
			<Header title="New Escrow Request" />

			<main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
				<form
					onSubmit={onSubmit}
					className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
				>
					{/* Side toggle */}
					<div className="space-y-2">
						<label className="block text-sm font-medium text-slate-700">
							Side
						</label>
						<div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
							<button
								type="button"
								onClick={() => setSide("sender")}
								className={`px-4 py-2 text-sm transition-colors ${
									side === "sender"
										? "bg-slate-900 text-white"
										: "bg-white text-slate-700 hover:bg-slate-100"
								}`}
								aria-pressed={side === "sender"}
							>
								Sender
							</button>
							<button
								type="button"
								onClick={() => setSide("receiver")}
								className={`px-4 py-2 text-sm transition-colors ${
									side === "receiver"
										? "bg-slate-900 text-white"
										: "bg-white text-slate-700 hover:bg-slate-100"
								}`}
								aria-pressed={side === "receiver"}
							>
								Receiver
							</button>
						</div>
						<p className="text-xs text-slate-500">
							Choose whether you are sending or receiving funds in this escrow.
						</p>
					</div>

					{/* Amount in SAT */}
					<div className="space-y-2">
						<label
							htmlFor="amount"
							className="block text-sm font-medium text-slate-700"
						>
							Amount (SAT)
						</label>
						<div className="relative">
							<input
								id="amount"
								name="amount"
								inputMode="numeric"
								pattern="[0-9]*"
								value={amount}
								onChange={(e) =>
									setAmount(e.target.value.replace(/[^\d]/g, ""))
								}
								placeholder="0"
								className={`w-full rounded-xl border bg-white px-4 py-2.5 text-slate-900 outline-none transition-shadow placeholder:text-slate-400
                ${errors.amount ? "border-red-300 ring-2 ring-red-100" : "border-slate-200 focus:ring-4 focus:ring-blue-500/10"}`}
								aria-invalid={!!errors.amount}
								aria-describedby={errors.amount ? "amount-error" : undefined}
							/>
							<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-500">
								SAT
							</span>
						</div>
						{errors.amount && (
							<p id="amount-error" className="text-xs text-red-600">
								{errors.amount}
							</p>
						)}
					</div>

					{/* Description */}
					<div className="space-y-2">
						<label
							htmlFor="description"
							className="block text-sm font-medium text-slate-700"
						>
							Description
						</label>
						<textarea
							id="description"
							name="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={255}
							rows={3}
							placeholder="What is this escrow for?"
							className={`w-full resize-y rounded-xl border bg-white px-4 py-2.5 text-slate-900 outline-none transition-shadow placeholder:text-slate-400
              ${errors.description ? "border-red-300 ring-2 ring-red-100" : "border-slate-200 focus:ring-4 focus:ring-blue-500/10"}`}
							aria-invalid={!!errors.description}
							aria-describedby={
								errors.description ? "description-error" : "description-help"
							}
						/>
						<div className="flex items-center justify-between">
							{errors.description ? (
								<p id="description-error" className="text-xs text-red-600">
									{errors.description}
								</p>
							) : (
								<p id="description-help" className="text-xs text-slate-500">
									Max 255 characters.
								</p>
							)}
							<p className="text-xs text-slate-400">{description.length}/255</p>
						</div>
					</div>

					{/* Public toggle */}
					<div className="space-y-2">
						<span className="block text-sm font-medium text-slate-700">
							Visibility
						</span>
						<button
							type="button"
							onClick={() => setIsPublic((v) => !v)}
							role="switch"
							aria-checked={isPublic}
							className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition
              ${isPublic ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50"}`}
						>
							<div className="text-left">
								<p className="text-sm font-medium text-slate-800">Public</p>
								<p className="text-xs text-slate-500">
									Allow others to view this escrow request.
								</p>
							</div>
							<span
								className={`relative inline-flex h-6 w-11 items-center rounded-full transition
                ${isPublic ? "bg-slate-900" : "bg-slate-300"}`}
								aria-hidden="true"
							>
								<span
									className={`inline-block h-5 w-5 transform rounded-full bg-white transition
                  ${isPublic ? "translate-x-6" : "translate-x-1"}`}
								/>
							</span>
						</button>
					</div>

					{/* Actions */}
					<div className="flex items-center justify-end gap-3 pt-2">
						<button
							type="button"
							onClick={() => router.back()}
							className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-blue-600 active:from-blue-700 active:to-blue-700"
						>
							Create Request
						</button>
					</div>
				</form>
			</main>
		</div>
	);
}
