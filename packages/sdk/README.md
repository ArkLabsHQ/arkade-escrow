# @arkade-escrow/sdk

Modular SDK for building multi-party contracts on the ARK protocol.

## Overview

This SDK abstracts the core primitives of multi-party Bitcoin contracts, enabling diverse use cases beyond escrow:

- **Escrow** - 2-of-3 buyer/seller/arbiter contracts
- **Lending** - Collateralized loans with liquidation
- **Gambling** - Multi-party pots and coinflips
- **P2P Exchanges** - Trustless peer-to-peer trading
- **Treasuries** - m-of-n multisig management

## Installation

```bash
npm install @arkade-escrow/sdk @arkade-os/sdk
```

## Quick Start

### Basic Escrow

```typescript
import { EscrowContract } from "@arkade-escrow/sdk";

const escrow = new EscrowContract({
  sender: { role: "sender", pubkey: senderKey },
  receiver: { role: "receiver", pubkey: receiverKey },
  serverPubkey: serverKey,
  unilateralDelay: { type: "blocks", value: 144 },
  amount: 100000, // satoshis
  description: "Payment for goods",
});

// Get funding address
const address = escrow.getAddressSync("ark", serverKey);
console.log(`Fund escrow at: ${address}`);

// Check state
console.log(escrow.getState()); // "draft"

// Counterparty accepts
await escrow.accept();
console.log(escrow.getState()); // "created"
```

### Custom m-of-n Script

```typescript
import { ScriptBuilder, createMultisigPath, createTimelockedPath } from "@arkade-escrow/sdk";

// 3-of-5 treasury with emergency 4-of-5 after 30 days
const treasury = new ScriptBuilder({
  parties: [
    { role: "signer1", pubkey: key1 },
    { role: "signer2", pubkey: key2 },
    { role: "signer3", pubkey: key3 },
    { role: "signer4", pubkey: key4 },
    { role: "signer5", pubkey: key5 },
    { role: "server", pubkey: serverKey },
  ],
  spendingPaths: [
    createMultisigPath(
      "standard",
      "Standard 3-of-5 spend",
      ["signer1", "signer2", "signer3", "signer4", "signer5", "server"],
    ),
    createTimelockedPath(
      "emergency",
      "Emergency 4-of-5 after 30 days",
      ["signer1", "signer2", "signer3", "signer4", "signer5"],
      { type: "blocks", value: 4320 },
    ),
  ],
});

const address = treasury.getAddress("ark", serverKey);
```

### Lending Contract

```typescript
import { LendingContract } from "@arkade-escrow/sdk";

const loan = new LendingContract({
  borrower: { role: "borrower", pubkey: borrowerKey },
  lender: { role: "lender", pubkey: lenderKey },
  serverPubkey: serverKey,
  collateralAmount: 1000000, // 1M sats collateral
  loanAmount: 500000, // 500k sats loan (50% LTV)
  interestRateBps: 500, // 5% interest
  repaymentAmount: 525000, // Principal + interest
  loanDuration: { type: "blocks", value: 4320 }, // ~30 days
  gracePeriod: { type: "blocks", value: 144 }, // ~1 day grace
  unilateralDelay: { type: "blocks", value: 144 },
  collateralizationRatio: 200, // 200%
});
```

## Architecture

### Layered Design

```
┌─────────────────────────────────────────────────────┐
│                  High-Level Modules                  │
│         (EscrowContract, LendingContract)           │
├─────────────────────────────────────────────────────┤
│                  Contract Primitives                 │
│        (StateMachine, BaseContract patterns)        │
├─────────────────────────────────────────────────────┤
│                  Transaction Layer                   │
│     (SigningCoordinator, signature merging)         │
├─────────────────────────────────────────────────────┤
│                    Core Layer                        │
│          (ScriptBuilder, Party, SpendingPath)       │
├───────────────────────┬─────────────────────────────┤
│    Storage Adapters   │    Protocol Adapters        │
│   (Memory, SQLite)    │    (ARK, Bitcoin)           │
└───────────────────────┴─────────────────────────────┘
```

### Core Concepts

#### Party

A participant in a contract with a role and public key:

```typescript
interface Party {
  role: string; // "sender", "receiver", "arbiter", "oracle", etc.
  pubkey: Uint8Array; // X-only public key (32 bytes)
  displayName?: string;
}
```

#### SpendingPath

A way to spend from the contract:

```typescript
interface SpendingPath {
  name: string; // "release", "refund", "liquidate"
  description: string;
  type: "multisig" | "csv-multisig" | "hash-preimage" | "conditional";
  requiredRoles: string[]; // Roles that must sign
  threshold: number; // Number of signatures needed
  timelock?: Timelock; // For CSV/CLTV paths
}
```

#### State Machine

Contracts use typed state machines for lifecycle management:

```typescript
const machine = new ContractStateMachine({
  initialState: "draft",
  states: [
    { name: "draft", allowedActions: ["accept", "reject"], isFinal: false },
    { name: "active", allowedActions: ["complete"], isFinal: false },
    { name: "completed", allowedActions: [], isFinal: true },
  ],
  transitions: [
    { from: "draft", action: "accept", to: "active" },
    { from: "active", action: "complete", to: "completed" },
  ],
});

await machine.perform("accept");
console.log(machine.getState()); // "active"
```

## Modules

### Escrow Module

2-of-3 escrow with sender, receiver, and arbiter:

- **Collaborative paths** (with server): release, refund, settle
- **Unilateral paths** (timelocked): unilateral-release, unilateral-refund, unilateral-settle

### Lending Module

Collateralized lending with:

- Borrower deposits collateral
- Lender disburses loan
- Repayment tracking
- Default and liquidation paths

## Storage Adapters

Bring your own persistence:

```typescript
import { StorageAdapter, MemoryStorageAdapter } from "@arkade-escrow/sdk";

// Use built-in memory adapter for testing
const storage = new MemoryStorageAdapter();

// Or implement your own
class PostgresAdapter implements StorageAdapter {
  async save(id: string, contract: StoredContract): Promise<void> {
    // Your implementation
  }
  // ... other methods
}
```

## Protocol Adapters

The SDK abstracts over blockchain protocols:

```typescript
import { ProtocolProvider } from "@arkade-escrow/sdk";

// Implement for your protocol
class ArkProvider implements ProtocolProvider {
  async getInfo(): Promise<ProtocolInfo> { ... }
  async getCoins(address: string): Promise<VirtualCoin[]> { ... }
  async submitTransaction(tx: SignedTransaction): Promise<SubmitResult> { ... }
  // ...
}
```

## Multi-Party Signing

The `SigningCoordinator` manages collecting signatures:

```typescript
import { SigningCoordinator } from "@arkade-escrow/sdk";

const coordinator = new SigningCoordinator(unsignedTx, checkpoints);

// Each party signs
coordinator.addSignature({
  role: "sender",
  pubkey: senderKey,
  signedPsbt: await senderWallet.sign(coordinator.getUnsignedPsbt()),
});

coordinator.addSignature({
  role: "receiver",
  pubkey: receiverKey,
  signedPsbt: await receiverWallet.sign(coordinator.getUnsignedPsbt()),
});

// Check completion
if (coordinator.isComplete()) {
  const { psbt, checkpoints } = coordinator.getSignedTransaction();
  await protocol.submitTransaction({ psbt, checkpoints });
}
```

## API Reference

### Core

- `ScriptBuilder` - Build Taproot scripts with m-of-n configurations
- `Party` - Define contract participants
- `SpendingPath` - Define spending conditions
- `createMultisigPath()` - Helper for multisig paths
- `createTimelockedPath()` - Helper for CSV timelocked paths

### Contracts

- `ContractStateMachine` - Generic state machine
- `createState()` - Helper for state definitions
- `createTransition()` - Helper for transitions

### Transactions

- `SigningCoordinator` - Multi-party signing coordination
- `mergePsbt()` - Merge PSBT signatures
- `mergeCheckpoints()` - Merge checkpoint signatures

### Storage

- `StorageAdapter` - Interface for persistence
- `MemoryStorageAdapter` - In-memory implementation

### Protocol

- `ProtocolProvider` - Interface for blockchain interaction
- `ArkProtocolProvider` - Extended interface for ARK

### Modules

- `EscrowContract` - Complete escrow implementation
- `LendingContract` - Collateralized lending implementation

## License

MIT
