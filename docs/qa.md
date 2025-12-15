# QA Quick Brief — Ark Escrow App

## What the app is
This is an **escrow application built on top of Ark**. Any user can participate as either:
- **Sender** (funds the escrow), or
- **Receiver** (ultimately receives the funds)

The app coordinates a simple lifecycle where users first express intent via a **Request**, then lock in terms via a **Contract**, then settle funds via **Execution** (or resolve via **Dispute/Arbitration**).

A basic **Backoffice** UI is also provided for monitoring and managing disputes.

### How to access the app

The app can be accessed in *hosted mode* under the `Apps` tab in the Ark wallet. 
It's currently available only in a specific branch: [Wallet with Escrow enabled on mutinynet](https://integrate-escrow-app.wallet-bitcoin.pages.dev/#)

The *standalone version* of the app is available [here on mutinynet](https://api.escrow.mutinynet.arkade.sh/client/).

The backoffice is available [at this address](https://api.escrow.mutinynet.arkade.sh/backoffice/) (credentials in chat).

---

## Core concepts

### Request
A **Request** is created by a user and represents an intent to escrow a specific amount.
- A Request can be created from **either side**:
    - **Receiver-side request**: “I want to receive X via escrow.”
    - **Sender-side request**: “I want to send X via escrow.”
- Another user can discover the Request and propose a **Contract** based on it.

### Contract
A **Contract** is created by a second user in response to a Request.
- The **Request creator** must **accept** the Contract before it can proceed.
- Once accepted, the **sender funds** the Contract.
- After funding, both parties can **execute** the Contract (order does not matter).
- After both executions are complete, the Contract status becomes **`Completed`** and funds are transferred to the receiver’s wallet.

### Dispute / Arbitration
If something goes wrong, either party can **open a dispute**, and an **arbitrator** resolves it with a verdict:
- **Release**: funds should go to the receiver
- **Refund**: funds should go back to the sender

After a verdict, an eligible party executes to finalize the transfer according to the verdict.

---

## Happy path (receiver-side request)
1. Alice creates a **Request** as a **receiver**
2. Bob sees the Request and creates a **Contract**
3. Alice **accepts** the Contract
4. Bob **funds** the Contract
5. Both users **execute** the Contract (in any order)
6. Once both executed, the Contract is marked **Completed** and funds are transferred to **Alice’s wallet**

### Happy path variant (sender-side request)
Same flow, but step 1 is:
- Alice creates a **Request** as a **sender**
  The rest remains the same: the counterparty creates a Contract, Request creator accepts, sender funds, both execute, then completion + transfer.

---

## Unhappy path example (dispute → Release)
1. Alice creates a **Request** as a **receiver**
2. Bob sees the Request and creates a **Contract**
3. Alice **accepts** the Contract
4. Bob **funds** the Contract
5. Bob opens a **dispute**
6. Arbitrator decides in Alice’s favor and emits a **Release** verdict
7. Alice **executes** the Contract and funds are transferred to her wallet

---

## Unhappy path variations to consider
- Sender/receiver sides inverted
- Dispute opened **after** the counterparty has already initiated execution
- Arbitrator emits a **Refund** verdict instead of Release
- Pre-settlement exits:
    - Request creator can **reject** a Contract
    - Contract creator can **cancel** it **before it’s funded**
    - Either party can **dispute** the Contract (where applicable)

---

## Key QA checkpoints
- Contract cannot be funded before acceptance
- Funding is visible to both parties once it arrives
- Execution can be performed by both parties in any order
- Completion requires **both** executions (normal happy path)
- After completion, funds land in the receiver wallet and status is **Completed**
- Dispute flow correctly blocks/overrides normal settlement and follows the arbitrator verdict (Release/Refund)