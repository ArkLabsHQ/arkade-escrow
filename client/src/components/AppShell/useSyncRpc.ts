import { useEffect, useRef, useState } from "react";

type Props = {
	timeout?: number;
	canExecute?: () => boolean;
};

/**
 * Consume an RPC as an async function.
 *
 * @param timeout (ms) default 10000
 * @param canExecute kill-switch for sync rpc, e.g. when user is not logged in
 */
export function useSyncRpc<O>({
	timeout = 2000,
	canExecute = () => true,
}: Props): [
	O | null,
	(result: O) => void,
	(executeRpc: () => void) => Promise<O>,
] {
	const [rpcResponse, setRpcResponse] = useState<O | null>(null);
	const rpcResponseResolveRef = useRef<((value: O) => void) | null>(null);
	const rpcResponseReject = useRef<((reason?: unknown) => void) | null>(null);
	const timeoutRef = useRef<number | null>(null);

	// Resolve pending signSignature promise when signedSignature state updates
	useEffect(() => {
		if (!rpcResponse) return;
		if (rpcResponseResolveRef.current) {
			rpcResponseResolveRef.current(rpcResponse);
		}
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		rpcResponseResolveRef.current = null;
		rpcResponseReject.current = null;
	}, [rpcResponse]);

	return [
		/**
		 * Last RPC response.
		 */
		rpcResponse,

		/**
		 * Callback for the RPC response.
		 * @param result
		 */
		(result: O): void => {
			setRpcResponse(result);
		},

		/**
		 * Execute the RPC and wrap the result in a promise.
		 * @param executeRpc Function that executes the RPC.
		 */
		(executeRpc: () => void): Promise<O> => {
			if (!canExecute()) return Promise.reject("cannot execute sync rpc");

			// Reset any previous pending promise
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			rpcResponseResolveRef.current = null;
			rpcResponseReject.current = null;

			setRpcResponse(null);

			executeRpc();

			return new Promise<O>((resolve, reject) => {
				rpcResponseResolveRef.current = resolve;
				rpcResponseReject.current = reject;

				timeoutRef.current = window.setTimeout(() => {
					rpcResponseResolveRef.current = null;
					rpcResponseReject.current = null;
					timeoutRef.current = null;
					reject("timeout");
				}, timeout);
			});
		},
	];
}
