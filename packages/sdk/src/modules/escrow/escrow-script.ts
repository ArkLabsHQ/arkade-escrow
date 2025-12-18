/**
 * Escrow Script Builder
 *
 * Builds the escrow-specific script configuration using the SDK primitives.
 */

import {
	ScriptConfig,
	SpendingPath,
	Party,
	Timelock,
	createMultisigPath,
	createTimelockedPath,
} from "../../core/index.js";
import { EscrowConfig, EscrowRole } from "./types.js";
import { stringToBytes } from "../../utils/index.js";

/**
 * Create the standard escrow spending paths.
 *
 * Escrow has 6 spending paths:
 * - 3 Collaborative (require server): release, refund, settle
 * - 3 Unilateral (timelocked, no server): unilateral-release, unilateral-refund, unilateral-settle
 */
export function createEscrowSpendingPaths(
	unilateralDelay: Timelock,
): SpendingPath[] {
	return [
		// Collaborative paths (with server participation)
		createMultisigPath(
			"release",
			"Release funds to receiver (goods delivered or dispute won)",
			["receiver", "arbiter", "server"],
		),
		createMultisigPath(
			"refund",
			"Refund funds to sender (dispute won by sender)",
			["sender", "arbiter", "server"],
		),
		createMultisigPath(
			"settle",
			"Direct settlement between sender and receiver (happy path)",
			["sender", "receiver", "server"],
		),

		// Unilateral paths (with timelock, no server needed)
		createTimelockedPath(
			"unilateral-release",
			"Release funds to receiver after timelock expires",
			["receiver", "arbiter"],
			unilateralDelay,
		),
		createTimelockedPath(
			"unilateral-refund",
			"Refund funds to sender after timelock expires",
			["sender", "arbiter"],
			unilateralDelay,
		),
		createTimelockedPath(
			"unilateral-settle",
			"Direct settlement after timelock expires (no server needed)",
			["sender", "receiver"],
			unilateralDelay,
		),
	];
}

/**
 * Create the parties list for an escrow contract.
 */
export function createEscrowParties(config: EscrowConfig): Party[] {
	// If no arbiter specified, create one using the server key
	const arbiter: Party = config.arbiter ?? {
		role: "arbiter",
		pubkey: config.serverPubkey,
		displayName: "Arbiter",
	};

	return [
		{ ...config.sender, role: "sender" },
		{ ...config.receiver, role: "receiver" },
		{ ...arbiter, role: "arbiter" },
		{
			role: "server",
			pubkey: config.serverPubkey,
			displayName: "Server",
		},
	];
}

/**
 * Build the complete script configuration for an escrow contract.
 */
export function buildEscrowScriptConfig(config: EscrowConfig): ScriptConfig {
	const parties = createEscrowParties(config);
	const spendingPaths = createEscrowSpendingPaths(config.unilateralDelay);

	// Generate nonce from config.nonce or undefined
	const nonce = config.nonce ? stringToBytes(config.nonce) : undefined;

	return {
		parties,
		spendingPaths,
		nonce,
		protocolServerKey: config.serverPubkey,
	};
}

/**
 * Get the signers required for a spending path.
 */
export function getSignersForPath(pathName: string): EscrowRole[] {
	const signers: Record<string, EscrowRole[]> = {
		release: ["receiver", "arbiter", "server"],
		refund: ["sender", "arbiter", "server"],
		settle: ["sender", "receiver", "server"],
		"unilateral-release": ["receiver", "arbiter"],
		"unilateral-refund": ["sender", "arbiter"],
		"unilateral-settle": ["sender", "receiver"],
	};

	return signers[pathName] ?? [];
}

/**
 * Check if a path requires the server to sign.
 */
export function isCollaborativePath(pathName: string): boolean {
	return ["release", "refund", "settle"].includes(pathName);
}

/**
 * Check if a path is timelocked.
 */
export function isTimelockedPath(pathName: string): boolean {
	return pathName.startsWith("unilateral-");
}

/**
 * Get the destination role for a spending path.
 * This determines who receives the funds when this path is used.
 */
export function getDestinationRole(
	pathName: string,
): "sender" | "receiver" | null {
	if (pathName === "release" || pathName === "unilateral-release") {
		return "receiver";
	}
	if (pathName === "refund" || pathName === "unilateral-refund") {
		return "sender";
	}
	// For settle paths, destination is specified at execution time
	return null;
}
