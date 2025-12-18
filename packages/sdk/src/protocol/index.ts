/**
 * Protocol module - Blockchain protocol adapters
 *
 * This module defines interfaces for interacting with blockchain protocols
 * and provides implementations for supported protocols.
 */

// Types
export type {
	ProtocolInfo,
	VirtualCoin,
	Balance,
	TxStatus,
	TxInfo,
	WatchCallback,
	ProtocolProvider,
	ArkProtocolProvider,
	ProtocolIndexer,
} from "./types.js";

export { ProtocolError } from "./types.js";
