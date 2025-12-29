/**
 * Protocol Adapter Types
 *
 * Defines interfaces for interacting with blockchain protocols.
 * The SDK abstracts over different protocols (ARK, Bitcoin on-chain, etc.)
 * through these interfaces.
 */

import { VtxoRef, SignedTransaction, SubmitResult } from "../transactions/types.js";
import { NetworkType, XOnlyPubKey } from "../core/types.js";

/**
 * Protocol information.
 */
export interface ProtocolInfo {
	/** Protocol name (e.g., "ark", "bitcoin") */
	name: string;
	/** Protocol version */
	version: string;
	/** Network type */
	network: NetworkType;
	/** Protocol-specific server public key (e.g., ASP key for ARK) */
	serverPubkey: XOnlyPubKey;
	/** Server pubkey as hex string */
	serverPubkeyHex: string;
	/** Unilateral exit delay in blocks (ARK-specific) */
	unilateralExitDelay?: number;
	/** Address prefix for this protocol */
	addressPrefix: string;
	/** Additional protocol-specific info */
	extra?: Record<string, unknown>;
}

/**
 * Virtual coin (UTXO equivalent for virtual protocols like ARK).
 */
export interface VirtualCoin extends VtxoRef {
	/** Whether this coin has been spent */
	isSpent: boolean;
	/** Transaction ID that spent this coin (if spent) */
	spentBy?: string;
	/** When this coin was created */
	createdAt: Date;
	/** When this coin was spent (if spent) */
	spentAt?: Date;
	/** The script/address this coin belongs to */
	script?: string;
}

/**
 * Balance information for an address/script.
 */
export interface Balance {
	/** Total confirmed balance in satoshis */
	confirmed: number;
	/** Pending/unconfirmed balance in satoshis */
	pending: number;
	/** Number of UTXOs/VTXOs */
	utxoCount: number;
}

/**
 * Transaction status.
 */
export type TxStatus =
	| "pending" // Submitted but not confirmed
	| "confirmed" // Confirmed on-chain or in round
	| "failed" // Failed to confirm
	| "unknown"; // Status unknown

/**
 * Transaction information.
 */
export interface TxInfo {
	/** Transaction ID */
	txid: string;
	/** Current status */
	status: TxStatus;
	/** Number of confirmations (for on-chain) */
	confirmations?: number;
	/** Block height (if confirmed) */
	blockHeight?: number;
	/** When the transaction was seen */
	timestamp?: Date;
	/** Fee paid in satoshis */
	fee?: number;
}

/**
 * Watch callback for address monitoring.
 */
export type WatchCallback = (coins: VirtualCoin[]) => void;

/**
 * Protocol provider interface.
 *
 * Implement this interface to add support for a new protocol.
 * The SDK uses this to interact with the blockchain/protocol
 * in a protocol-agnostic way.
 *
 * @example
 * ```typescript
 * class BitcoinProvider implements ProtocolProvider {
 *   async getInfo(): Promise<ProtocolInfo> {
 *     return {
 *       name: "bitcoin",
 *       version: "0.21.0",
 *       network: "mainnet",
 *       serverPubkey: this.serverKey,
 *       addressPrefix: "bc",
 *     };
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface ProtocolProvider {
	/**
	 * Get protocol information.
	 */
	getInfo(): Promise<ProtocolInfo>;

	/**
	 * Get all coins (spent and unspent) for a script/address.
	 */
	getCoins(scriptOrAddress: string): Promise<VirtualCoin[]>;

	/**
	 * Get only spendable (unspent) coins for a script/address.
	 */
	getSpendableCoins(scriptOrAddress: string): Promise<VirtualCoin[]>;

	/**
	 * Get balance for a script/address.
	 */
	getBalance(scriptOrAddress: string): Promise<Balance>;

	/**
	 * Submit a signed transaction.
	 *
	 * @param tx - The signed transaction to submit
	 * @returns Result including txid and any protocol-specific data
	 */
	submitTransaction(tx: SignedTransaction): Promise<SubmitResult>;

	/**
	 * Get transaction information.
	 */
	getTransaction(txid: string): Promise<TxInfo | null>;

	/**
	 * Watch an address for new coins.
	 *
	 * @param address - The address to watch
	 * @param callback - Called when new coins are detected
	 * @returns Unsubscribe function
	 */
	watchAddress(address: string, callback: WatchCallback): () => void;

	/**
	 * Stop watching an address.
	 */
	unwatchAddress(address: string): void;
}

/**
 * Extended protocol provider with ARK-specific functionality.
 */
export interface ArkProtocolProvider extends ProtocolProvider {
	/**
	 * Finalize a transaction by submitting signed checkpoints.
	 *
	 * ARK requires checkpoint transactions to be finalized
	 * after the main transaction is submitted.
	 */
	finalizeTransaction(
		txid: string,
		signedCheckpoints: string[],
	): Promise<void>;

	/**
	 * Build an unsigned transaction for a script.
	 *
	 * @param inputs - The VTXOs to spend
	 * @param outputs - The outputs to create
	 * @param tapTree - The tap tree for the inputs
	 * @param tapLeafScript - The spending path
	 * @returns Unsigned PSBT and checkpoints
	 */
	buildTransaction(
		inputs: VtxoRef[],
		outputs: Array<{ address: string; amount: bigint }>,
		tapTree: Uint8Array,
		tapLeafScript: Uint8Array,
	): Promise<{
		arkTx: string;
		checkpoints: string[];
	}>;

	/**
	 * Get the unroll script for the server.
	 * This is needed for building ARK transactions.
	 */
	getServerUnrollScript(): Promise<Uint8Array>;
}

/**
 * Protocol indexer interface.
 *
 * Some protocols have separate indexer services for querying
 * blockchain data. This interface abstracts over those.
 */
export interface ProtocolIndexer {
	/**
	 * Query coins by scripts.
	 *
	 * @param scripts - Hex-encoded scripts to query
	 * @returns Coins and pagination info
	 */
	getCoins(
		scripts: string[],
	): Promise<{ coins: VirtualCoin[]; hasMore: boolean }>;

	/**
	 * Get transaction details.
	 */
	getTransaction(txid: string): Promise<TxInfo | null>;

	/**
	 * Get transactions for a script/address.
	 */
	getTransactions(
		scriptOrAddress: string,
		options?: { limit?: number; offset?: number },
	): Promise<TxInfo[]>;
}

/**
 * Error thrown by protocol operations.
 */
export class ProtocolError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "ProtocolError";
	}
}
