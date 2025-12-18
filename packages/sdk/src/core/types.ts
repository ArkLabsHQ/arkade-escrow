/**
 * Core types for the Arkade SDK
 *
 * These types form the foundation for building multi-party contracts
 * with flexible m-of-n configurations.
 */

/**
 * X-only public key (32 bytes) - standard for Taproot/Schnorr
 */
export type XOnlyPubKey = Uint8Array;

/**
 * A party in a contract with a role name and public key.
 *
 * Roles are arbitrary strings - not restricted to sender/receiver/arbiter.
 * This enables diverse use cases: lending (borrower/lender/liquidator),
 * gambling (player1/player2/oracle), treasuries (signer1..signerN), etc.
 */
export interface Party {
	/** Unique role identifier (e.g., "buyer", "seller", "arbiter", "oracle", "signer1") */
	role: string;
	/** X-only public key (32 bytes) */
	pubkey: XOnlyPubKey;
	/** Human-readable display name (optional) */
	displayName?: string;
	/** Additional metadata for the party (optional) */
	metadata?: Record<string, unknown>;
}

/**
 * Timelock configuration for spending paths.
 *
 * Used with CSV (CheckSequenceVerify) for relative timelocks
 * or CLTV (CheckLockTimeVerify) for absolute timelocks.
 */
export interface Timelock {
	/** Type of timelock */
	type: "blocks" | "seconds";
	/** Timelock value (block height/count or Unix timestamp/duration) */
	value: number;
}

/**
 * Spending condition types supported by the SDK.
 */
export type SpendingConditionType =
	| "multisig" // Standard m-of-n multisig (all listed parties must sign)
	| "csv-multisig" // CSV (CheckSequenceVerify) timelocked multisig
	| "cltv-multisig" // CLTV (CheckLockTimeVerify) absolute timelock multisig
	| "hash-preimage" // Hash preimage reveal (HTLC-style)
	| "conditional"; // Custom script condition with multisig

/**
 * Hash types supported for hash-preimage spending conditions.
 */
export type HashType = "sha256" | "hash160" | "ripemd160";

/**
 * Hash condition for hash-preimage spending paths (HTLC-style).
 */
export interface HashCondition {
	/** Hash algorithm used */
	hashType: HashType;
	/** The hash that must be satisfied (preimage reveal) */
	hash: Uint8Array;
}

/**
 * A spending path definition.
 *
 * Each spending path represents one way to spend from the contract.
 * The ScriptBuilder uses these to construct the Taproot tree.
 */
export interface SpendingPath {
	/** Unique name for this spending path (e.g., "release", "refund", "liquidate") */
	name: string;
	/** Human-readable description of when this path is used */
	description: string;
	/** Type of spending condition */
	type: SpendingConditionType;
	/**
	 * Roles required to satisfy this path (by role name).
	 * All listed roles must sign to satisfy a multisig path.
	 * For threshold signatures, use the `threshold` field.
	 */
	requiredRoles: string[];
	/**
	 * Number of signatures required.
	 * For standard multisig paths, this equals requiredRoles.length.
	 * For threshold multisig (m-of-n), this is m where n = requiredRoles.length.
	 *
	 * Note: Current implementation requires all requiredRoles to sign.
	 * True m-of-n threshold is planned for future versions.
	 */
	threshold: number;
	/** Optional timelock for CSV/CLTV paths */
	timelock?: Timelock;
	/** Optional hash condition for hash-preimage paths */
	hashCondition?: HashCondition;
	/** Optional custom script for conditional paths */
	customScript?: Uint8Array;
}

/**
 * Configuration for building a multi-party script.
 *
 * This is the main configuration object passed to ScriptBuilder.
 */
export interface ScriptConfig {
	/** All parties involved in this contract */
	parties: Party[];
	/** All spending paths available */
	spendingPaths: SpendingPath[];
	/**
	 * Optional nonce for address uniqueness.
	 * When provided, creates a "ghost" script that makes the address unique
	 * even with the same parties and paths.
	 */
	nonce?: Uint8Array;
	/**
	 * Protocol-specific server/coordinator key.
	 * For ARK, this is the ASP (Ark Service Provider) public key.
	 */
	protocolServerKey?: XOnlyPubKey;
}

/**
 * Built script information returned by ScriptBuilder.
 */
export interface BuiltScript {
	/** The encoded tap tree */
	tapTree: Uint8Array;
	/** Map of spending path names to their leaf scripts */
	leafScripts: Map<string, Uint8Array>;
	/** The script configuration used to build this */
	config: ScriptConfig;
}

/**
 * Network type for Bitcoin-compatible protocols.
 */
export type NetworkType = "bitcoin" | "testnet" | "signet" | "regtest";

/**
 * Address information returned by script builder.
 */
export interface AddressInfo {
	/** The bech32m encoded address */
	address: string;
	/** The network this address is for */
	network: NetworkType;
	/** The underlying script pubkey */
	scriptPubKey: Uint8Array;
}

/**
 * Validation error for script configuration.
 */
export class ScriptConfigError extends Error {
	constructor(
		message: string,
		public readonly field?: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "ScriptConfigError";
	}
}

/**
 * Validates that a public key is a valid x-only format (32 bytes).
 */
export function isValidXOnlyPubKey(pubkey: Uint8Array): boolean {
	return pubkey.length === 32;
}

/**
 * Validates a party definition.
 */
export function validateParty(party: Party): void {
	if (!party.role || party.role.trim().length === 0) {
		throw new ScriptConfigError("Party role cannot be empty", "role");
	}
	if (!isValidXOnlyPubKey(party.pubkey)) {
		throw new ScriptConfigError(
			`Invalid public key length for party "${party.role}": expected 32 bytes, got ${party.pubkey.length}`,
			"pubkey",
		);
	}
}

/**
 * Validates a spending path definition.
 */
export function validateSpendingPath(
	path: SpendingPath,
	availableRoles: Set<string>,
): void {
	if (!path.name || path.name.trim().length === 0) {
		throw new ScriptConfigError("Spending path name cannot be empty", "name");
	}

	if (path.requiredRoles.length === 0) {
		throw new ScriptConfigError(
			`Spending path "${path.name}" must have at least one required role`,
			"requiredRoles",
		);
	}

	for (const role of path.requiredRoles) {
		if (!availableRoles.has(role)) {
			throw new ScriptConfigError(
				`Spending path "${path.name}" references unknown role "${role}"`,
				"requiredRoles",
				{ unknownRole: role, availableRoles: Array.from(availableRoles) },
			);
		}
	}

	if (path.threshold < 1 || path.threshold > path.requiredRoles.length) {
		throw new ScriptConfigError(
			`Spending path "${path.name}" has invalid threshold: ${path.threshold} (must be 1-${path.requiredRoles.length})`,
			"threshold",
		);
	}

	if (
		(path.type === "csv-multisig" || path.type === "cltv-multisig") &&
		!path.timelock
	) {
		throw new ScriptConfigError(
			`Spending path "${path.name}" of type "${path.type}" requires a timelock`,
			"timelock",
		);
	}

	if (path.type === "hash-preimage" && !path.hashCondition) {
		throw new ScriptConfigError(
			`Spending path "${path.name}" of type "hash-preimage" requires a hashCondition`,
			"hashCondition",
		);
	}

	if (path.type === "conditional" && !path.customScript) {
		throw new ScriptConfigError(
			`Spending path "${path.name}" of type "conditional" requires a customScript`,
			"customScript",
		);
	}
}

/**
 * Validates a complete script configuration.
 */
export function validateScriptConfig(config: ScriptConfig): void {
	if (config.parties.length === 0) {
		throw new ScriptConfigError(
			"Script configuration must have at least one party",
			"parties",
		);
	}

	if (config.spendingPaths.length === 0) {
		throw new ScriptConfigError(
			"Script configuration must have at least one spending path",
			"spendingPaths",
		);
	}

	// Validate all parties
	const roles = new Set<string>();
	const pubkeys = new Set<string>();

	for (const party of config.parties) {
		validateParty(party);

		if (roles.has(party.role)) {
			throw new ScriptConfigError(
				`Duplicate role "${party.role}" in parties`,
				"parties",
			);
		}
		roles.add(party.role);

		const pubkeyHex = Buffer.from(party.pubkey).toString("hex");
		if (pubkeys.has(pubkeyHex)) {
			throw new ScriptConfigError(
				`Duplicate public key for party "${party.role}"`,
				"parties",
			);
		}
		pubkeys.add(pubkeyHex);
	}

	// Validate all spending paths
	const pathNames = new Set<string>();
	for (const path of config.spendingPaths) {
		validateSpendingPath(path, roles);

		if (pathNames.has(path.name)) {
			throw new ScriptConfigError(
				`Duplicate spending path name "${path.name}"`,
				"spendingPaths",
			);
		}
		pathNames.add(path.name);
	}

	// Validate nonce if provided
	if (config.nonce && config.nonce.length < 16) {
		throw new ScriptConfigError(
			`Nonce too short: expected at least 16 bytes, got ${config.nonce.length}`,
			"nonce",
		);
	}

	// Validate protocol server key if provided
	if (config.protocolServerKey && !isValidXOnlyPubKey(config.protocolServerKey)) {
		throw new ScriptConfigError(
			`Invalid protocol server key length: expected 32 bytes, got ${config.protocolServerKey.length}`,
			"protocolServerKey",
		);
	}
}
