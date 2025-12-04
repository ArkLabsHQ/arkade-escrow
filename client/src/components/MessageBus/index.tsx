import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import makeMessageHandler from "./MessageManager";
import { nanoid } from "nanoid";
import { SingleKey } from "@arkade-os/sdk";
import { InboundMessage, OutboundMessage } from "@/components/MessageBus/types";
import { AppShellImpl } from "@/components/MessageBus/AppShellImpl";

export type Transaction = {
	vtxo: {
		txid: string;
		vout: number;
		value: number;
	};
	arkTx: string; // The Ark transaction as PSBT
	checkpoints: string[]; // Checkpoint transactions as PSBTs
};

export function useIsIframe() {
	const [isIframe, setIsIframe] = useState(false);

	useEffect(() => {
		setIsIframe(window.self !== window.top);
	}, []);

	return isIframe;
}

type MessageBridgeContextValue = {
	signChallenge: (challenge: string) => Promise<string>;
	xPublicKey: string | null;
	walletAddress: string | null;
	signTransaction: (
		transaction: Transaction,
	) => Promise<{ tx: string; checkpoints: string[] }>;
	fundAddress: (address: string, amount: number) => Promise<void>;
	getWalletBalance: () => Promise<{ available: number }>;
};

export type MessageEventLike = {
	data: InboundMessage;
	origin: string;
	source: MessageEventSource | null;
};
export interface AppShell {
	postMessage: (
		message: OutboundMessage,
		targetOrigin: string,
		transfer?: Transferable[],
	) => void;
}

const MessageBridgeContext = createContext<
	MessageBridgeContextValue | undefined
>(undefined);

export function MessageProvider({
	children,
}: {
	children: React.ReactNode;
	allowedChildOrigins: string[];
}) {
	const [isAlive, setIsAlive] = useState(false);
	const [xPublicKey, setXPublicKey] = useState<string | null>(null);
	const [walletAddress, setWalletAddress] = useState<string | null>(null);
	const [hostOrigin, setHostOrigin] = useState<string | null>(null);
	const handleMessage = useMemo(() => makeMessageHandler({}), []);
	const parentWindowRef = useRef<AppShell | null>(null);

	// Store pending promise handlers to avoid stale closures
	const [signedChallenge, setSignedChallenge] = useState<string | null>(null);
	const pendingChallengeResolveRef = useRef<((value: string) => void) | null>(
		null,
	);
	const pendingChallengeRejectRef = useRef<((reason?: unknown) => void) | null>(
		null,
	);
	const timeoutChallengeRef = useRef<number | null>(null);

	// Store pending promise handlers to avoid stale closures
	const [signedSignature, setSignedSignature] = useState<{
		tx: string;
		checkpoints: string[];
	} | null>(null);
	const pendingSignatureResolveRef = useRef<
		((value: { tx: string; checkpoints: string[] }) => void) | null
	>(null);
	const pendingSignatureRejectRef = useRef<((reason?: unknown) => void) | null>(
		null,
	);
	const timeoutSignatureRef = useRef<number | null>(null);

	// Store pending promise handlers to avoid stale closures
	const [walletBalance, setWalletBalance] = useState<{
		available: number;
	}>({ available: 0 });

	const onMessage = useCallback(
		async (event: MessageEventLike) => {
			const msg = event.data as InboundMessage;
			try {
				const result = await handleMessage(msg);
				if (result.tag === "failure") {
					console.error(result.error);
				} else {
					const resultContent = result.result;
					switch (resultContent.kind) {
						case "DATA":
							switch (resultContent.topic) {
								case "xOnlyPublicKey":
									setXPublicKey(resultContent.xOnlyPublicKey);
									break;
								case "signedChallenge":
									console.log(
										"[escrow] signed challenge",
										resultContent.signedChallenge,
									);
									setSignedChallenge(resultContent.signedChallenge);
									break;
								case "arkWalletAddress":
									console.log(
										"[escrow] ark wallet address",
										resultContent.arkWalletAddress,
									);
									setWalletAddress(resultContent.arkWalletAddress);
									break;
								case "arkWalletBalance":
									console.log("[escrow] ark wallet balance", resultContent);
									setWalletBalance({ available: resultContent.available });
									break;
								case "signedTransaction":
									console.log(
										"[escrow] signed transaction",
										resultContent.signedTransaction,
									);
									setSignedSignature(resultContent.signedTransaction);
									break;
								case "transactionId":
									console.log(
										`[escrow] funded with txid=${resultContent.txid}`,
									);
							}
							break;
						case "ARKADE_KEEP_ALIVE": {
							if (!isAlive) {
								setIsAlive(true);
							}
							if (!xPublicKey) {
								parentWindowRef.current?.postMessage(
									{
										kind: "ARKADE_RPC_REQUEST",
										id: nanoid(8),
										method: "get-x-public-key",
									},
									event.origin,
								);
							}
							if (!walletAddress) {
								parentWindowRef.current?.postMessage(
									{
										kind: "ARKADE_RPC_REQUEST",
										id: nanoid(8),
										method: "get-ark-wallet-address",
									},
									event.origin,
								);
								parentWindowRef.current?.postMessage(
									{
										kind: "ARKADE_RPC_REQUEST",
										id: nanoid(8),
										method: "get-ark-wallet-balance",
									},
									event.origin,
								);
							}
							setTimeout(
								() =>
									parentWindowRef.current?.postMessage(
										result.result,
										event.origin,
									),
								2000,
							);
							break;
						}
						default:
							console.warn(result.result);
					}
				}
			} catch (err) {
				console.error("[escrow]: error handling message", err);
				return;
			}
		},
		[handleMessage, isAlive, xPublicKey, walletAddress],
	);

	const isIframe = useIsIframe();
	useEffect(() => {
		if (!isIframe && !parentWindowRef.current) {
			setIsAlive(true);
			// TODO: ask for key/mnemonic if they prefer
			console.log("[escrow] creating new identity");
			const identity = SingleKey.fromRandomBytes();
			parentWindowRef.current = new AppShellImpl(onMessage, identity);
			parentWindowRef.current.postMessage(
				{ kind: "ARKADE_KEEP_ALIVE", timestamp: Date.now() },
				"*",
			);
		} else {
			if (typeof window === "undefined") {
				return;
			}
			const listener = (event: MessageEvent) => {
				// Keep a reference to the sender window (e.g., the iframe content window)
				if (event.source) {
					parentWindowRef.current = event.source as Window;
				}
				onMessage(event);
			};
			window.addEventListener("message", listener);
			return () => {
				window.removeEventListener("message", listener);
			};
		}
	}, [isIframe, onMessage]);

	// Resolve pending signChallenge promise when signedChallenge state updates
	useEffect(() => {
		if (!signedChallenge) return;
		if (pendingChallengeResolveRef.current) {
			pendingChallengeResolveRef.current(signedChallenge);
		}
		if (timeoutChallengeRef.current) {
			clearTimeout(timeoutChallengeRef.current);
			timeoutChallengeRef.current = null;
		}
		pendingChallengeResolveRef.current = null;
		pendingChallengeRejectRef.current = null;
	}, [signedChallenge]);

	// Resolve pending signSignature promise when signedSignature state updates
	useEffect(() => {
		if (!signedSignature) return;
		if (pendingSignatureResolveRef.current) {
			pendingSignatureResolveRef.current(signedSignature);
		}
		if (timeoutSignatureRef.current) {
			clearTimeout(timeoutSignatureRef.current);
			timeoutSignatureRef.current = null;
		}
		pendingSignatureResolveRef.current = null;
		pendingSignatureRejectRef.current = null;
	}, [signedSignature]);

	return (
		<MessageBridgeContext.Provider
			value={{
				xPublicKey,
				walletAddress,
				signChallenge: async (challenge: string) => {
					if (isIframe && !hostOrigin) return Promise.reject("app not ready");

					// Reset any previous pending promise
					if (timeoutChallengeRef.current) {
						clearTimeout(timeoutChallengeRef.current);
						timeoutChallengeRef.current = null;
					}
					pendingChallengeResolveRef.current = null;
					pendingChallengeRejectRef.current = null;

					setSignedChallenge(null);
					parentWindowRef.current?.postMessage(
						{
							kind: "ARKADE_RPC_REQUEST",
							id: nanoid(8),
							method: "sign-login-challenge",
							payload: { challenge },
						},
						hostOrigin,
					);

					return new Promise<string>((resolve, reject) => {
						pendingChallengeResolveRef.current = resolve;
						pendingChallengeRejectRef.current = reject;

						timeoutChallengeRef.current = window.setTimeout(() => {
							pendingChallengeResolveRef.current = null;
							pendingChallengeRejectRef.current = null;
							timeoutChallengeRef.current = null;
							reject("timeout");
						}, 10000);
					});
				},
				getWalletBalance: () => {
					if (!isIframe) {
						// TODO: figure out how to get the balance from the app shell when not in an iframe
						return Promise.resolve({ available: 0 });
					}
					if (!hostOrigin) return Promise.reject("app not ready");
					parentWindowRef.current?.postMessage(
						{
							kind: "ARKADE_RPC_REQUEST",
							id: nanoid(8),
							method: "get-ark-wallet-balance",
						},
						hostOrigin,
					);
					return new Promise((resolve) => {
						// is 1s enough?
						window.setTimeout(() => resolve(walletBalance), 1000);
					});
				},
				signTransaction: (transaction: Transaction) => {
					if (!hostOrigin && isIframe) return Promise.reject("app not ready");

					// Reset any previous pending promise
					if (timeoutSignatureRef.current) {
						clearTimeout(timeoutSignatureRef.current);
						timeoutSignatureRef.current = null;
					}
					pendingSignatureResolveRef.current = null;
					pendingSignatureRejectRef.current = null;

					setSignedSignature(null);
					parentWindowRef.current?.postMessage(
						{
							kind: "ARKADE_RPC_REQUEST",
							id: nanoid(8),
							method: "sign-transaction",
							payload: {
								tx: transaction.arkTx,
								checkpoints: transaction.checkpoints,
							},
						},
						hostOrigin,
					);

					return new Promise<{ tx: string; checkpoints: string[] }>(
						(resolve, reject) => {
							pendingSignatureResolveRef.current = resolve;
							pendingSignatureRejectRef.current = reject;

							timeoutSignatureRef.current = window.setTimeout(() => {
								pendingSignatureResolveRef.current = null;
								pendingSignatureRejectRef.current = null;
								timeoutSignatureRef.current = null;
								reject("timeout");
							}, 10000);
						},
					);
				},
				fundAddress: async (address: string, amount: number) => {
					if (!isIframe) {
						// TODO: QR code? link to wallet/browser extension/...
						return Promise.resolve();
					}
					if (!hostOrigin) return Promise.reject("app not ready");

					parentWindowRef.current?.postMessage(
						{
							kind: "ARKADE_RPC_REQUEST",
							id: nanoid(8),
							method: "fund-address",
							payload: { address, amount },
						},
						hostOrigin,
					);
				},
			}}
		>
			{children}
		</MessageBridgeContext.Provider>
	);
}

export function useMessageBridge(): MessageBridgeContextValue {
	const ctx = useContext(MessageBridgeContext);
	if (!ctx) {
		throw new Error("useMessageBridge must be used within a MessageProvider");
	}
	return ctx;
}
