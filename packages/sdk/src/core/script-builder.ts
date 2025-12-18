/**
 * ScriptBuilder - Generic Taproot script builder for multi-party contracts
 *
 * This class generalizes the VEscrow.Script pattern to support any m-of-n
 * configuration with flexible spending paths.
 */

import { hex } from "@scure/base";
import { Script as BtcScript } from "@scure/btc-signer";
import { hash160 } from "@scure/btc-signer/utils.js";
import {
	VtxoScript,
	TapLeafScript,
	MultisigTapscript,
	CSVMultisigTapscript,
	ConditionMultisigTapscript,
	RelativeTimelock,
} from "@arkade-os/sdk";

import {
	ScriptConfig,
	SpendingPath,
	Party,
	XOnlyPubKey,
	Timelock,
	validateScriptConfig,
	ScriptConfigError,
} from "./types.js";

/**
 * Convert SDK Timelock to ARK RelativeTimelock format
 */
function toRelativeTimelock(timelock: Timelock): RelativeTimelock {
	return {
		type: timelock.type,
		value: BigInt(timelock.value),
	};
}

/**
 * Generic script builder that creates Taproot trees for any m-of-n configuration.
 *
 * This is the core primitive for building multi-party contracts. It takes a
 * configuration of parties and spending paths, and produces a Taproot tree
 * that can be used to create addresses and spend funds.
 *
 * @example
 * ```typescript
 * // 2-of-3 escrow with 6 spending paths
 * const builder = new ScriptBuilder({
 *   parties: [
 *     { role: "sender", pubkey: senderKey },
 *     { role: "receiver", pubkey: receiverKey },
 *     { role: "arbiter", pubkey: arbiterKey },
 *     { role: "server", pubkey: serverKey },
 *   ],
 *   spendingPaths: [
 *     { name: "release", type: "multisig", requiredRoles: ["receiver", "arbiter", "server"], threshold: 3 },
 *     { name: "refund", type: "multisig", requiredRoles: ["sender", "arbiter", "server"], threshold: 3 },
 *     // ... more paths
 *   ],
 * });
 *
 * const address = builder.getAddress("ark", serverKey);
 * ```
 *
 * @example
 * ```typescript
 * // 5-of-9 treasury
 * const builder = new ScriptBuilder({
 *   parties: signers.map((key, i) => ({ role: `signer${i}`, pubkey: key })),
 *   spendingPaths: [
 *     { name: "spend", type: "multisig", requiredRoles: allSignerRoles, threshold: 5 },
 *   ],
 * });
 * ```
 */
export class ScriptBuilder {
	private readonly config: ScriptConfig;
	private readonly vtxoScript: VtxoScript;
	private readonly leafScripts: Map<string, Uint8Array>;
	private readonly leafScriptHexes: Map<string, string>;

	constructor(config: ScriptConfig) {
		// Validate configuration
		validateScriptConfig(config);

		this.config = config;
		this.leafScripts = new Map();
		this.leafScriptHexes = new Map();
		this.vtxoScript = this.buildScript();
	}

	/**
	 * Build the Taproot tree from spending paths
	 */
	private buildScript(): VtxoScript {
		const scripts: Uint8Array[] = [];

		for (const path of this.config.spendingPaths) {
			const leafScript = this.buildLeafScript(path);
			this.leafScripts.set(path.name, leafScript);
			this.leafScriptHexes.set(path.name, hex.encode(leafScript));
			scripts.push(leafScript);
		}

		// Add ghost script if nonce is provided (for unique addresses)
		if (this.config.nonce) {
			const ghostScript = this.buildGhostScript();
			this.leafScripts.set("__ghost__", ghostScript);
			this.leafScriptHexes.set("__ghost__", hex.encode(ghostScript));
			scripts.push(ghostScript);
		}

		return new VtxoScript(scripts);
	}

	/**
	 * Build a ghost script that makes addresses unique.
	 * This uses a hash-preimage condition that can never be satisfied
	 * but affects the Taproot tree root.
	 */
	private buildGhostScript(): Uint8Array {
		if (!this.config.nonce) {
			throw new ScriptConfigError("Cannot build ghost script without nonce");
		}

		// Get all party pubkeys for the ghost script
		const allPubkeys = this.config.parties.map((p) => p.pubkey);

		return ConditionMultisigTapscript.encode({
			pubkeys: allPubkeys,
			conditionScript: BtcScript.encode([
				"HASH160",
				hash160(this.config.nonce),
				"EQUAL",
			]),
		}).script;
	}

	/**
	 * Build a single leaf script for a spending path
	 */
	private buildLeafScript(path: SpendingPath): Uint8Array {
		const pubkeys = this.getPubkeysForPath(path);

		switch (path.type) {
			case "multisig":
				return MultisigTapscript.encode({ pubkeys }).script;

			case "csv-multisig":
				if (!path.timelock) {
					throw new ScriptConfigError(
						`CSV multisig path "${path.name}" requires timelock`,
					);
				}
				return CSVMultisigTapscript.encode({
					pubkeys,
					timelock: toRelativeTimelock(path.timelock),
				}).script;

			case "cltv-multisig":
				// CLTV uses absolute timelocks - would need CLTVMultisigTapscript
				// For now, fall back to CSV which is relative
				if (!path.timelock) {
					throw new ScriptConfigError(
						`CLTV multisig path "${path.name}" requires timelock`,
					);
				}
				// TODO: Implement proper CLTV support when @arkade-os/sdk provides it
				return CSVMultisigTapscript.encode({
					pubkeys,
					timelock: toRelativeTimelock(path.timelock),
				}).script;

			case "hash-preimage":
				if (!path.hashCondition) {
					throw new ScriptConfigError(
						`Hash-preimage path "${path.name}" requires hashCondition`,
					);
				}
				// Build hash-preimage + multisig script
				const hashOp =
					path.hashCondition.hashType === "sha256"
						? "SHA256"
						: path.hashCondition.hashType === "hash160"
							? "HASH160"
							: "RIPEMD160";

				return ConditionMultisigTapscript.encode({
					pubkeys,
					conditionScript: BtcScript.encode([
						hashOp,
						path.hashCondition.hash,
						"EQUAL",
					]),
				}).script;

			case "conditional":
				if (!path.customScript) {
					throw new ScriptConfigError(
						`Conditional path "${path.name}" requires customScript`,
					);
				}
				return ConditionMultisigTapscript.encode({
					pubkeys,
					conditionScript: path.customScript,
				}).script;

			default:
				throw new ScriptConfigError(
					`Unknown spending path type: ${(path as SpendingPath).type}`,
				);
		}
	}

	/**
	 * Get public keys for a spending path based on required roles
	 */
	private getPubkeysForPath(path: SpendingPath): XOnlyPubKey[] {
		return path.requiredRoles.map((role) => {
			const party = this.config.parties.find((p) => p.role === role);
			if (!party) {
				throw new ScriptConfigError(
					`Spending path "${path.name}" references unknown role "${role}"`,
				);
			}
			return party.pubkey;
		});
	}

	/**
	 * Get the TapLeafScript for a named spending path.
	 * This is used when building transactions to spend via a specific path.
	 */
	getSpendingPath(name: string): TapLeafScript {
		const leafScriptHex = this.leafScriptHexes.get(name);
		if (!leafScriptHex) {
			throw new ScriptConfigError(`Spending path "${name}" not found`);
		}
		return this.vtxoScript.findLeaf(leafScriptHex);
	}

	/**
	 * Get all available spending paths with their metadata
	 */
	getSpendingPaths(): SpendingPath[] {
		return this.config.spendingPaths;
	}

	/**
	 * Get spending path metadata by name
	 */
	getSpendingPathInfo(name: string): SpendingPath | undefined {
		return this.config.spendingPaths.find((p) => p.name === name);
	}

	/**
	 * Get the leaf script bytes for a named spending path
	 */
	getLeafScript(name: string): Uint8Array {
		const leafScript = this.leafScripts.get(name);
		if (!leafScript) {
			throw new ScriptConfigError(`Spending path "${name}" not found`);
		}
		return leafScript;
	}

	/**
	 * Get all parties in this script configuration
	 */
	getParties(): Party[] {
		return this.config.parties;
	}

	/**
	 * Get a specific party by role
	 */
	getParty(role: string): Party | undefined {
		return this.config.parties.find((p) => p.role === role);
	}

	/**
	 * Get the public key for a role
	 */
	getPubkey(role: string): XOnlyPubKey | undefined {
		return this.getParty(role)?.pubkey;
	}

	/**
	 * Get the address for this script (protocol-specific).
	 *
	 * @param prefix - Address prefix (e.g., "ark" for ARK protocol)
	 * @param serverKey - Protocol server's x-only public key
	 * @returns The bech32m encoded address
	 */
	getAddress(prefix: string, serverKey: XOnlyPubKey): string {
		return this.vtxoScript.address(prefix, serverKey).encode();
	}

	/**
	 * Get the encoded tap tree (for use in transaction building)
	 */
	getTapTree(): Uint8Array {
		return this.vtxoScript.encode();
	}

	/**
	 * Get the underlying VtxoScript instance.
	 * Advanced usage - prefer the higher-level methods.
	 */
	getVtxoScript(): VtxoScript {
		return this.vtxoScript;
	}

	/**
	 * Get the original configuration used to build this script
	 */
	getConfig(): ScriptConfig {
		return this.config;
	}

	/**
	 * Check if a spending path exists
	 */
	hasSpendingPath(name: string): boolean {
		return this.leafScripts.has(name);
	}

	/**
	 * Get the roles required to sign for a spending path
	 */
	getRequiredSigners(pathName: string): string[] {
		const path = this.getSpendingPathInfo(pathName);
		if (!path) {
			throw new ScriptConfigError(`Spending path "${pathName}" not found`);
		}
		return path.requiredRoles;
	}
}

/**
 * Helper function to create a simple multisig spending path
 */
export function createMultisigPath(
	name: string,
	description: string,
	requiredRoles: string[],
): SpendingPath {
	return {
		name,
		description,
		type: "multisig",
		requiredRoles,
		threshold: requiredRoles.length,
	};
}

/**
 * Helper function to create a timelocked multisig spending path
 */
export function createTimelockedPath(
	name: string,
	description: string,
	requiredRoles: string[],
	timelock: Timelock,
): SpendingPath {
	return {
		name,
		description,
		type: "csv-multisig",
		requiredRoles,
		threshold: requiredRoles.length,
		timelock,
	};
}

/**
 * Helper function to create a hash-preimage spending path (HTLC-style)
 */
export function createHashPreimagePath(
	name: string,
	description: string,
	requiredRoles: string[],
	hash: Uint8Array,
	hashType: "sha256" | "hash160" | "ripemd160" = "sha256",
): SpendingPath {
	return {
		name,
		description,
		type: "hash-preimage",
		requiredRoles,
		threshold: requiredRoles.length,
		hashCondition: {
			hashType,
			hash,
		},
	};
}
