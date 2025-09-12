# Proposal: ARK Escrow (2‑of‑3) with Coordinator/Arbitration Server, Wallet Injection, and Optional LN (Boltz) Interop

This proposal describes a fresh, production‑ready ARK escrow system. You can reuse components or code ideas from these references, or build fresh:

- Reference app: https://github.com/Kukks/ark-escrow-demo
- Ark TypeScript SDK: https://github.com/arkade-os/ts-sdk/

Build whichever way is fastest and cleanest; pull out only what you need.

---

## Plain‑English Overview

- Escrow holds funds until conditions are met.
- Parties: Sender (pays) and Receiver (gets paid). Arbitrator resolves disputes.
- Runs on Ark (fast, low fees).
- A server coordinates escrows, hosts a public order book, enforces a service fee, and helps parties finalize partially signed transactions.
- A web app lets users create, join, fund, release/refund. It works standalone or embedded in a wallet via iframe & `window.arkade`.
- Lightning (Boltz) interop: fund escrow from LN; pay out to LN.

---

## What We’re Building

- A polished escrow UX (create request, share link, accept, fund, release/refund, cancel if unfunded).
- A Coordinator/Arbitration server with REST + realtime updates and a simple order book for PUBLIC requests.
- Service fee (fixed or basis points) applied to payouts.
- Wallet injection via `window.arkade` implementing the SDK’s `Identity` interface.
- Lightning interop using Boltz swaps (LN→Ark funding and Ark→LN payout).
- Simple Docker stack for server + client; SQLite for storage.

Terminology used throughout: Sender, Receiver, Arbitrator.

---

## Architecture Overview

- Ark settlement and script tooling via `@arkade-os/ts-sdk`.
- Coordinator/Arbitration Server (Node/TypeScript)
  - Manages escrow requests, escrows, order book.
  - Coordinates PSBT exchange; enforces service fees.
  - Can store minimal user profiles (pubkey + optional name).
  - Provides arbitration when a party refuses to sign.
- Client Web App
  - Create/accept/cancel requests, see order book.
  - Manage escrows; fund; request Release/Refund; sign when needed.
  - Wallet injection via `window.arkade` (preferred). Fallback: local key (generate/import).
  - Simple wallet UI: show Ark receive address; dead-simple send.

Script model: A 2‑of‑3 design (Sender, Receiver, Arbitrator). Collaborative paths can include a server‑assisted flow; unilateral paths (timelocked) allow Arb+Sender or Arb+Receiver to resolve disputes if one party refuses.

---

## Escrow Lifecycle

1. Create Request
   - Provide: your pubkey, side (Sender or Receiver), optional amount, description, PUBLIC flag.
   - Receive a shareable URL for the counterparty.
2. Accept Request
   - Counterparty opens link and provides their pubkey.
   - Escrow is formed (Sender, Receiver, Arbitrator), and an escrow address can be derived.
3. Escrow Address
   - Deterministic from pubkeys + policy; shown to both parties.
4. Funding
   - Sender funds the escrow address (optionally via LN→Ark reverse swap).
5. Actions
   - If unfunded: creator (and generally any party) can cancel by proving ownership.
   - If funded:
     - Receiver can “Request Release” (payout to Receiver minus service fee).
     - Sender can “Request Refund.”
     - Each request creates a partially signed Ark transaction toward the intended payout.
     - Either party may “Reject” a pending Release/Refund request (records rejection, clears the pending request; may trigger arbitration per policy).
6. Cosigning and Finalization
   - Default: Sender and Receiver co‑sign; server coordinates collection.
   - Arbitrator does not sign by default. If a party refuses, Arbitrator may step in and build a new transaction on the Arb+party path (subject to timelock/policy) and finalize with the cooperating party.

---

## Coordinator/Arbitration Server

Responsibilities
- Host public order book (PUBLIC requests).
- Manage escrow requests and acceptance.
- Track escrow state (created, funded, executed) via an indexer.
- Coordinate PSBTs; apply service fee to payout outputs.
- Arbitration: construct Arb+Sender or Arb+Receiver transactions (respecting timelock) when disputes arise.

Fee Policy
- Fixed or bps, deducted from payout output.
- Fee address configurable.

Auth (simple and secure)
- “Sign‑in with Ark” style per‑request signatures (inspired by HodlHodl’s signed‑request):
  - Client sends headers: `X-Ark-PubKey`, `X-Nonce`, `X-Signature`.
  - Signature covers `method|path|nonce|sha256(body)`.
  - Server verifies signature against pubkey. No passwords, no key upload.

### API (draft)

Users (optional)
- POST /users → upsert minimal profile

Requests
- POST /escrows/requests → create { side, pubkey, amount?, description, public? } → { id, shareUrl }
- GET  /escrows/requests/:id → details
- POST /escrows/requests/:id/accept → { pubkey }
- POST /escrows/requests/:id/cancel → signed by creator
- GET  /orderbook → public, open requests

Escrows
- GET  /escrows/:id → escrow details (Sender, Receiver, Arbitrator, arkAddress, feePolicy, state)
- GET  /escrows/:id/state → { status: created|funded|executed, balance }
- GET  /escrows/mine → paginated list of escrows for the authenticated pubkey (query: status?, limit?, cursor?)

Actions
- POST /escrows/:id/actions/:action/request → { partialPsbt(s), intended outputs } for Release/Refund
- POST /escrows/:id/actions/:action/approve → co‑signer attaches signatures
- POST /escrows/:id/actions/:action/reject → records rejection, clears pending request, notifies counterparties; may trigger arbitration per policy (optional body: { reason?: string })
- POST /escrows/:id/arbitrate → Arbitrator constructs Arb+party tx (timelock‑aware) and finalizes with cooperating party

Chat (optional)
- GET  /escrows/:id/chat → paginated messages (query: cursor?, limit?)
- POST /escrows/:id/chat → post a message; headers carry auth, body: { message, nonce, signature }
  - Signature covers method|path|nonce|sha256(message) (same header scheme as other endpoints)
- DELETE /escrows/:id/chat/:messageId → optional, arbitrator/moderator only

Realtime
- SSE/WebSocket for updates, pending signature/rejection notifications, chat messages, state changes.

---

## Client Web App

Screens
- Connect Ark server
- Create Request (side, amount?, description, PUBLIC)
- Request Detail (share link)
- Accept Request (via link)
- My Escrows (history for your pubkey)
- Escrow Dashboard (state, actions incl. Approve/Reject on pending Release/Refund)
 - Escrow Chat (optional): in‑escrow chat panel on the Escrow Dashboard (message list, composer)
- Public Order Book
- Simple Wallet: show Ark receive address; minimal send

Wallet Injection (`window.arkade`)
- Implements SDK `Identity` interface:
  - `sign(tx: Transaction, inputIndexes?: number[]): Promise<Transaction>`
  - `xOnlyPublicKey(): Uint8Array`
  - `signerSession(): SignerSession`
- If embedded as an iframe in a host wallet, use postMessage RPC to call those methods.
- Fallback: local `SingleKey` in the browser (import/generate).
- UI is responsive (mobile and desktop) and adapts to iframe embedding (dynamic height/layout; no scroll nesting).

---

## Lightning Interop (Boltz)

Funding (LN→Ark)
- Reverse submarine swap that deposits to the escrow Ark address (user pays LN invoice).

Payout (Ark→LN)
- Release/Refund can target a Boltz Ark address initiating an Ark→LN swap; recipient receives sats over LN.

Reference: https://github.com/arkade-os/boltz-swap

Show quotes/fees prior to commit; poll status until complete.

---

## Security and Privacy

- Private keys remain client‑side (or inside the host wallet if injected).
- Requests authenticated by per‑request signatures; no password sessions.
- Arbitrator key is isolated server‑side and only used under explicit arbitration/finalization rules.
- Maintain an audit log of actions and signature events.

---

## Deliverables & Acceptance Criteria

Server (Node/TypeScript)
- REST + SSE/WS.
- Fee policy (fixed or bps) applied to payouts.
- Order book for PUBLIC requests.
- Per‑request signature auth with nonce.
- State tracking via Ark indexer.
- Arbitration flows (Arb+Sender / Arb+Receiver), timelock‑aware.
- LN interop via Boltz (funding and payout).

Client Web App
- Create/accept/cancel requests; shareable links.
- Escrow dashboard with actions (Fund, Request Release, Request Refund, Approve/Reject).
- History view: list previous/current escrows for your pubkey; search/sort/filter.
- Co‑signing UX (pending signatures, approvals/rejections).
- Wallet injection via `window.arkade` (`Identity` methods) with local key fallback; simple send/receive UI.
- LN funding/payout with Boltz: quotes/fees and status tracking.
- Responsive UI (mobile and desktop) and iframe embedding support (dynamic height/layout; no scroll nesting).
- Optional: In‑escrow chat panel with message list, composer, and notifications.

Docker Stack (required)
- `docker-compose.yml` that brings up:
  - api: server (exposes HTTP port), uses SQLite for storage.
  - ui: client (served either by the api or a tiny static server like nginx).
  - A volume/bind mount for SQLite file persistence.
- One command to run: `docker compose up -d` and the UI is reachable.

Documentation
- README with setup, environment variables, and “happy path” + “dispute path”.
- API reference (OpenAPI/Swagger preferred).
- `window.arkade` postMessage RPC schema and examples.

## Milestones

- M1: Server baseline (auth, requests, order book) + SQLite.
- M2: Escrow formation and deterministic address; state tracking.
- M3: Actions (Release/Refund): PSBT build, co‑signing, finalization with fee.
- M4: Arbitration flows (Arb+party, timelock‑aware), audit log.
- M5: Web app polish + `window.arkade` injection + local key fallback + simple wallet.
- M6: Optional: LN interop via Boltz (funding and payout).
- M7: Docker stack, docs.
- M8: Optional: In‑escrow chat between parties (signed messages, SSE/WS notifications).

---

## References

- Reference app: https://github.com/Kukks/ark-escrow-demo
- Ark TypeScript SDK: https://github.com/arkade-os/ts-sdk/
- Target wallet injection interface (Identity): `sign`, `xOnlyPublicKey`, `signerSession`
