import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { nanoid } from "nanoid";
import { SingleKey } from "@arkade-os/sdk";

import { InboundMessage, KeepAlive, OutboundMessage } from "./types";
import { Standalone } from "./Standalone";
import makeMessageHandler from "./messageHandler";
import { useSyncRpc } from "@/components/AppShell/useSyncRpc";

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

type RpcProviderContextValue = {
	isHosted: boolean;
	signChallenge: (challenge: string) => Promise<string>;
	xPublicKey: string | null;
	walletAddress: string | null;
	signTransaction: (
		arkTx: string,
		checkpoints: string[],
	) => Promise<{ tx: string; checkpoints: string[] }>;
	fundAddress: (address: string, amount: number) => Promise<string>;
	getWalletBalance: () => Promise<{ available: number }>;
};

const RpcProviderContext = createContext<RpcProviderContextValue | undefined>(
	undefined,
);

export function RpcProvider({
	children,
	identity,
	hosted = false,
}: {
	children: React.ReactNode;
	identity?: SingleKey;
	hosted?: boolean;
}) {
	const [isAlive, setIsAlive] = useState(false);
	const [xPublicKey, setXPublicKey] = useState<string | null>(null);
	const [walletAddress, setWalletAddress] = useState<string | null>(null);
	const [hostOrigin, setHostOrigin] = useState<string | null>(
		hosted ? null : "appshell",
	);
	const handleMessage = useMemo(() => makeMessageHandler({}), []);
	const parentWindowRef = useRef<AppShell | null>(null);

	const canExecute = useCallback(
		() => (hosted ? hostOrigin !== null : true),
		[hosted, hostOrigin],
	);

	const [_a, onSignedChallenge, signChallenge] = useSyncRpc<string>({
		canExecute,
	});

	const [_b, onSignedTransaction, signTransaction] = useSyncRpc<{
		tx: string;
		checkpoints: string[];
	}>({
		canExecute,
	});

	const [_c, onPrivateKey, getPrivateKey] = useSyncRpc<string>({ canExecute });

	const [_f, onAddressFunded, fundAddress] = useSyncRpc<string>({
		canExecute,
	});

	// Store pending promise handlers to avoid stale closures
	const [walletBalance, setWalletBalance] = useState<{
		available: number;
	}>({ available: 0 });

	const onMessage = useCallback(
		async (event: MessageEventLike) => {
			if (event.origin === window.location.origin) {
				// ignore broadcasted messages from the same origin
				return;
			}

			if (hostOrigin === null) {
				setHostOrigin(event.origin);
			}
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
								case "privateKey":
									onPrivateKey(resultContent.privateKey);
									break;
								case "signedChallenge":
									onSignedChallenge(resultContent.signedChallenge);
									break;
								case "arkWalletAddress":
									setWalletAddress(resultContent.arkWalletAddress);
									break;
								case "arkWalletBalance":
									setWalletBalance({ available: resultContent.available });
									break;
								case "signedTransaction":
									onSignedTransaction(resultContent.signedTransaction);
									break;
								case "transactionId":
									onAddressFunded(resultContent.txid);
									break;
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
							if (!walletAddress && hosted) {
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
										resultContent as KeepAlive,
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
		[
			handleMessage,
			isAlive,
			xPublicKey,
			walletAddress,
			hostOrigin,
			onPrivateKey,
			onSignedChallenge,
			onSignedTransaction,
			hosted,
		],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `hosted` cannot change at runtime
	useEffect(() => {
		const needsInit = parentWindowRef.current === null;
		if (hosted) {
			// we are inside an iframe
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
			if (needsInit) {
				console.log(
					"[escrow] Hosted mode: ",
					hostOrigin ?? window.location.origin,
				);
				// broadcast the first keep alive message
				window.postMessage(
					{
						kind: "ARKADE_KEEP_ALIVE",
						timestamp: Date.now(),
					},
					"*",
				);
			}
			return () => {
				window.removeEventListener("message", listener);
			};
		} else {
			setIsAlive(true);
			parentWindowRef.current = new Standalone(
				// rebinding is necessary to ensure that the `onMessage` callback sees the latest values
				(event: MessageEventLike) => onMessage(event),
				identity ?? SingleKey.fromRandomBytes(),
			);
			if (needsInit) {
				console.log("[escrow] Standalone mode");
				parentWindowRef.current.postMessage(
					{
						kind: "ARKADE_KEEP_ALIVE",
						timestamp: Date.now(),
					},
					"*",
				);
			}
			return;
		}
	}, [onMessage]);

	return (
		<RpcProviderContext.Provider
			value={{
				isHosted: Boolean(hosted),
				xPublicKey,
				walletAddress,
				signChallenge: (challenge: string): Promise<string> =>
					signChallenge(() => {
						parentWindowRef.current?.postMessage(
							{
								kind: "ARKADE_RPC_REQUEST",
								id: nanoid(8),
								method: "sign-login-challenge",
								payload: { challenge },
							},
							hostOrigin ?? "appshell",
						);
					}),
				getWalletBalance: () => {
					if (!hosted) {
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

				/**
				 *
				 * @param tx Base64
				 * @param checkpoints Base64
				 */
				signTransaction: (tx: string, checkpoints: string[]) =>
					signTransaction(() =>
						parentWindowRef.current?.postMessage(
							{
								kind: "ARKADE_RPC_REQUEST",
								id: nanoid(8),
								method: "sign-transaction",
								payload: {
									tx,
									checkpoints,
								},
							},
							hostOrigin ?? "appshell",
						),
					),
				fundAddress: async (
					address: string,
					amount: number,
				): Promise<string> => {
					if (!hosted) {
						// TODO: QR code? link to wallet/browser extension/...
						return Promise.reject("Cannot send bitcoin from standalone escrow");
					}
					return fundAddress(() =>
						parentWindowRef.current?.postMessage(
							{
								kind: "ARKADE_RPC_REQUEST",
								id: nanoid(8),
								method: "fund-address",
								payload: { address, amount },
							},
							hostOrigin ?? "appshell",
						),
					);
				},
			}}
		>
			{children}
		</RpcProviderContext.Provider>
	);
}

export function useAppShell(): RpcProviderContextValue {
	const ctx = useContext(RpcProviderContext);
	if (!ctx) {
		throw new Error("useMessageBridge must be used within a MessageProvider");
	}
	return ctx;
}

export function useIsHosted(): boolean {
	const ctx = useContext(RpcProviderContext);
	if (!ctx) {
		throw new Error("useMessageBridge must be used within a MessageProvider");
	}
	return ctx.isHosted;
}
