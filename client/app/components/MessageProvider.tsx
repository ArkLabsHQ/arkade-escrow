// client/app/components/MessageProvider.tsx
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

type MessageBridgeContextValue = {
	signChallenge: (challenge: string) => Promise<string>;
	xPublicKey: string | null;
};

const MessageBridgeContext = createContext<
	MessageBridgeContextValue | undefined
>(undefined);

export function MessageProvider({
	children,
	allowedChildOrigins,
}: {
	children: React.ReactNode;
	allowedChildOrigins: string[];
}) {
	const allowed = useMemo(
		() => new Set(allowedChildOrigins),
		[allowedChildOrigins],
	);
	const [isAlive, seIsAlive] = useState(false);
	const [xPublicKey, setXPublicKey] = useState<string | null>(null);
	const [signedChallenge, setSignedChallenge] = useState<string | null>(null);
	const [hostOrigin, setHostOrigin] = useState<string | null>(null);
	const handleMessage = useMemo(() => makeMessageHandler({}), []);
	const childWindowRef = useRef<Window | null>(null);
	// Store pending promise handlers to avoid stale closures
	const pendingResolveRef = useRef<((value: string) => void) | null>(null);
	const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);
	const timeoutRef = useRef<number | null>(null);

	const onMessage = useCallback(
		async (event: MessageEvent) => {
			if (!allowed.has(event.origin)) {
				console.warn(`Arkade: ignoring message from ${event.origin}`);
				return;
			}
			if (event.origin !== hostOrigin) {
				setHostOrigin(event.origin);
			}
			// Keep a reference to the sender window (e.g., the iframe content window)
			if (
				event.source &&
				typeof (event.source as Window).postMessage === "function"
			) {
				childWindowRef.current = event.source as Window;
			}

			const msg = event.data;
			if (!msg || typeof msg !== "object" || !("kind" in msg)) {
				console.error("Arkade: invalid message", msg);
				return;
			}

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
							}
							break;
						case "ARKADE_KEEP_ALIVE": {
							if (!isAlive) {
								seIsAlive(true);
							}
							if (!xPublicKey) {
								childWindowRef.current?.postMessage(
									{
										kind: "ARKADE_RPC_REQUEST",
										id: nanoid(8),
										method: "get-x-publick-key",
									},
									event.origin,
								);
							}
							console.log("[escrow] answer k.a.", result.result, event.origin);
							setTimeout(
								() =>
									childWindowRef.current?.postMessage(
										result.result,
										event.origin,
									),
								5000,
							);
							break;
						}
						default:
							console.log(result.result);
					}
				}
			} catch (err) {
				console.error("[escrow]: error handling message", err);
				return;
			}
		},
		[handleMessage, allowed, isAlive, hostOrigin, xPublicKey],
	);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.addEventListener("message", onMessage);
		return () => {
			window.removeEventListener("message", onMessage);
		};
	}, [onMessage]);

	// Resolve pending signChallenge promise when signedChallenge state updates
	useEffect(() => {
		if (!signedChallenge) return;
		if (pendingResolveRef.current) {
			pendingResolveRef.current(signedChallenge);
		}
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		pendingResolveRef.current = null;
		pendingRejectRef.current = null;
	}, [signedChallenge]);

	return (
		<MessageBridgeContext.Provider
			value={{
				xPublicKey,
				signChallenge: async (challenge: string) => {
					if (!hostOrigin) return Promise.reject("app not ready");

					// Reset any previous pending promise
					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current);
						timeoutRef.current = null;
					}
					pendingResolveRef.current = null;
					pendingRejectRef.current = null;

					setSignedChallenge(null);
					childWindowRef.current?.postMessage(
						{
							kind: "ARKADE_RPC_REQUEST",
							id: nanoid(8),
							method: "sign-login-challenge",
							payload: { challenge },
						},
						hostOrigin,
					);

					return new Promise<string>((resolve, reject) => {
						pendingResolveRef.current = resolve;
						pendingRejectRef.current = reject;

						timeoutRef.current = window.setTimeout(() => {
							pendingResolveRef.current = null;
							pendingRejectRef.current = null;
							timeoutRef.current = null;
							reject("timeout");
						}, 10000);
					});
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
