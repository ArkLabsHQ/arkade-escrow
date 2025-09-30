import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------- Message schema (parent <-> child) ---------- */

type RpcMethod =
  | "xOnlyPublicKey"
  | "sign"
  | "signerSession"
  | "signin"
  | "signout";

type RpcRequest = {
  kind: "ARKADE_RPC_REQUEST";
  id: string;
  method: RpcMethod;
  params?: unknown;
};

type RpcResponse =
  | {
      kind: "ARKADE_RPC_RESPONSE";
      id: string;
      ok: true;
      result: unknown;
    }
  | {
      kind: "ARKADE_RPC_RESPONSE";
      id: string;
      ok: false;
      error: { message: string; code?: string; data?: unknown };
    };

type UiResizeMsg = { kind: "ARKADE_UI_RESIZE"; height: number };
type ChildReadyMsg = { kind: "ARKADE_CHILD_READY" };
type AnyIncoming = RpcRequest | UiResizeMsg | ChildReadyMsg;

/** ---------- Parent wallet-side handlers you provide ---------- */

export type ArkadeIdentityHandlers = {
  xOnlyPublicKey: () => Promise<Uint8Array> | Uint8Array;
  sign: (tx: unknown, inputIndexes?: number[]) => Promise<unknown>;
  signerSession: () => Promise<unknown>;
  signin: (params: unknown) => Promise<unknown>;
  signout: () => Promise<unknown>;
};

type Props = {
  src: string;
  allowedChildOrigins: string[];
  handlers: ArkadeIdentityHandlers;
  className?: string;
  autoHeight?: boolean;
  minHeight?: number;
};

export const ArkadeIframeHost: React.FC<Props> = ({
  src,
  allowedChildOrigins,
  handlers,
  className,
  autoHeight = true,
  minHeight = 400,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(minHeight);

  const allowed = useMemo(() => new Set(allowedChildOrigins), [allowedChildOrigins]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (!allowed.has(event.origin)) return;
      const msg = event.data as AnyIncoming;
      if (!msg || typeof msg !== "object" || !("kind" in msg)) return;

      if (msg.kind === "ARKADE_UI_RESIZE") {
        if (autoHeight && typeof msg.height === "number") {
          setHeight(Math.max(minHeight, Math.ceil(msg.height)));
        }
        return;
      }

      if (msg.kind === "ARKADE_CHILD_READY") {
        return;
      }

      if (msg.kind === "ARKADE_RPC_REQUEST") {
        const { id, method, params } = msg;

        const respond = (response: RpcResponse) => {
          iframeRef.current?.contentWindow?.postMessage(response, event.origin);
        };

        try {
          let result: unknown;
          switch (method) {
            case "xOnlyPublicKey": {
              const bytes = await handlers.xOnlyPublicKey();
              const b64 = uint8ToBase64(bytes as Uint8Array);
              result = { xOnlyPublicKeyB64: b64 };
              break;
            }
            case "sign": {
              const { tx, inputIndexes } = (params ?? {}) as { tx: unknown; inputIndexes?: number[] };
              result = await handlers.sign(tx, inputIndexes);
              break;
            }
            case "signerSession": {
              result = await handlers.signerSession();
              break;
            }
            case "signin": {
              result = await handlers.signin(params);
              break;
            }
            case "signout": {
              result = await handlers.signout();
              break;
            }
            default: {
              throw new Error(`Unknown method: ${String(method)}`);
            }
          }
          respond({ kind: "ARKADE_RPC_RESPONSE", id, ok: true, result });
        } catch (err: any) {
          respond({
            kind: "ARKADE_RPC_RESPONSE",
            id,
            ok: false,
            error: {
              message: err?.message ?? "Unknown error",
              code: err?.code,
              data: err?.data,
            },
          });
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [allowed, handlers, autoHeight, minHeight]);

  return (
    <div className={className}>
      <iframe
        ref={iframeRef}
        title="Ark Escrow"
        src={src}
        style={{ width: "100%", height: `${height}px`, border: 0, display: "block" }}
        sandbox="allow-scripts allow-forms allow-same-origin"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
