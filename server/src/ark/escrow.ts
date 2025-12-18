/**
 * Virtual Escrow Contract - Now powered by @arkade-escrow/sdk
 *
 * This file maintains backward compatibility with the original VEscrow API
 * while using the SDK's ScriptBuilder internally.
 */

import { Bytes } from "@scure/btc-signer/utils.js";
import { hex } from "@scure/base";
import { VtxoScript, TapLeafScript } from "@arkade-os/sdk";
import { RelativeTimelock } from "@arkade-os/sdk";
import {
	ScriptBuilder,
	ScriptConfig,
	Party,
	Timelock,
	bytesToHex,
} from "@arkade-escrow/sdk";

export type Signers = "sender" | "receiver" | "server" | "arbitrator";

/**
 * Virtual Escrow Contract (VEC) namespace containing types and implementation
 * for a 3-party escrow contract with a sender, receiver, and arbitrator.
 */
export namespace VEscrow {
	/**
	 * Configuration options for the escrow contract
	 */
	export type Options = {
		/** Buyer's x-only public key */
		sender: Bytes;
		/** Seller's x-only public key */
		receiver: Bytes;
		/** Arbitrator's x-only public key */
		arbitrator: Bytes;
		/** Ark server's x-only public key */
		server: Bytes;
		/** Unilateral delay for unilateral paths */
		unilateralDelay: RelativeTimelock;
		/** Nonce to make addresses unique per escrow */
		nonce?: Bytes;
	};

	/**
	 * Convert VEscrow.Options to SDK ScriptConfig
	 */
	function optionsToScriptConfig(options: Options): ScriptConfig {
		const timelock: Timelock = {
			type: options.unilateralDelay.type,
			value: Number(options.unilateralDelay.value),
		};

		const parties: Party[] = [
			{ role: "sender", pubkey: options.sender },
			{ role: "receiver", pubkey: options.receiver },
			{ role: "arbitrator", pubkey: options.arbitrator },
			{ role: "server", pubkey: options.server },
		];

		return {
			parties,
			spendingPaths: [
				// Collaborative paths (with server)
				{
					name: "release",
					description: "Release funds to receiver (goods delivered)",
					type: "multisig",
					requiredRoles: ["receiver", "arbitrator", "server"],
					threshold: 3,
				},
				{
					name: "refund",
					description: "Refund funds to sender (dispute resolved)",
					type: "multisig",
					requiredRoles: ["sender", "arbitrator", "server"],
					threshold: 3,
				},
				{
					name: "direct",
					description: "Direct settlement between parties",
					type: "multisig",
					requiredRoles: ["sender", "receiver", "server"],
					threshold: 3,
				},
				// Unilateral paths (with timelock)
				{
					name: "unilateral-release",
					description: "Release funds after timelock",
					type: "csv-multisig",
					requiredRoles: ["receiver", "arbitrator"],
					threshold: 2,
					timelock,
				},
				{
					name: "unilateral-refund",
					description: "Refund funds after timelock",
					type: "csv-multisig",
					requiredRoles: ["sender", "arbitrator"],
					threshold: 2,
					timelock,
				},
				{
					name: "unilateral-direct",
					description: "Direct settlement after timelock",
					type: "csv-multisig",
					requiredRoles: ["sender", "receiver"],
					threshold: 2,
					timelock,
				},
			],
			nonce: options.nonce,
			protocolServerKey: options.server,
		};
	}

	/**
	 * Virtual Escrow Contract Script implementation
	 *
	 * Provides 6 spending paths:
	 * - Collaborative (with server): release, refund, direct
	 * - Unilateral (with timelock): unilateralRelease, unilateralRefund, unilateralDirect
	 *
	 * Now powered by @arkade-escrow/sdk ScriptBuilder
	 */
	export class Script extends VtxoScript {
		readonly releaseFundsScript: string;
		readonly returnFundsScript: string;
		readonly directScript: string;
		readonly receiverDisputeUnilateralScript: string;
		readonly senderDisputeUnilateralScript: string;
		readonly unilateralDirectScript: string;
		readonly ghostScript?: string;

		private readonly scriptBuilder: ScriptBuilder;

		constructor(readonly options: Options) {
			// Convert options to SDK config and build with ScriptBuilder
			const config = optionsToScriptConfig(options);
			const builder = new ScriptBuilder(config);

			// Get the underlying VtxoScript from the builder
			const vtxoScript = builder.getVtxoScript();

			// Initialize parent with the scripts from the builder
			super(vtxoScript.scripts);

			this.scriptBuilder = builder;

			// Map SDK path names to legacy script hex strings
			this.releaseFundsScript = bytesToHex(builder.getLeafScript("release"));
			this.returnFundsScript = bytesToHex(builder.getLeafScript("refund"));
			this.directScript = bytesToHex(builder.getLeafScript("direct"));
			this.receiverDisputeUnilateralScript = bytesToHex(
				builder.getLeafScript("unilateral-release"),
			);
			this.senderDisputeUnilateralScript = bytesToHex(
				builder.getLeafScript("unilateral-refund"),
			);
			this.unilateralDirectScript = bytesToHex(
				builder.getLeafScript("unilateral-direct"),
			);

			// Ghost script if nonce provided
			if (options.nonce && builder.hasSpendingPath("__ghost__")) {
				this.ghostScript = bytesToHex(builder.getLeafScript("__ghost__"));
			}
		}

		/**
		 * Get the tap leaf script for collaborative release path
		 * (receiver + arbitrator + server)
		 */
		releaseFunds(): TapLeafScript {
			return this.scriptBuilder.getSpendingPath("release");
		}

		/**
		 * Get the tap leaf script for collaborative refund path
		 * (sender + arbitrator + server)
		 */
		returnFunds(): TapLeafScript {
			return this.scriptBuilder.getSpendingPath("refund");
		}

		/**
		 * Get the tap leaf script for collaborative direct path
		 * (sender + receiver + server)
		 */
		direct(): TapLeafScript {
			return this.scriptBuilder.getSpendingPath("direct");
		}

		/**
		 * Get the tap leaf script for unilateral release path
		 * (receiver + arbitrator after timelock)
		 */
		receiverDisputeUnilateral(): TapLeafScript {
			return this.scriptBuilder.getSpendingPath("unilateral-release");
		}

		/**
		 * Get the tap leaf script for unilateral refund path
		 * (sender + arbitrator after timelock)
		 */
		senderDisputeUniteral(): TapLeafScript {
			return this.scriptBuilder.getSpendingPath("unilateral-refund");
		}

		/**
		 * Get the tap leaf script for unilateral direct path
		 * (sender + receiver after timelock)
		 */
		unilateralDirect(): TapLeafScript {
			return this.scriptBuilder.getSpendingPath("unilateral-direct");
		}

		/**
		 * Get all available spending paths with their descriptions
		 */
		getSpendingPaths(): Array<{
			name: string;
			type: "collaborative" | "unilateral";
			description: string;
			script: string;
			signers: Signers[];
		}> {
			return [
				{
					name: "releaseFunds",
					type: "collaborative",
					description: "Release funds to receiver (goods delivered)",
					script: this.releaseFundsScript,
					signers: ["receiver", "arbitrator", "server"],
				},
				{
					name: "returnFunds",
					type: "collaborative",
					description: "Refund funds to sender (dispute resolved)",
					script: this.returnFundsScript,
					signers: ["sender", "arbitrator", "server"],
				},
				{
					name: "direct",
					type: "collaborative",
					description: "Direct settlement between parties",
					script: this.directScript,
					signers: ["sender", "receiver", "server"],
				},
				{
					name: "receiverDisputeUnilateral",
					type: "unilateral",
					description: "Release funds after timelock",
					script: this.receiverDisputeUnilateralScript,
					signers: ["receiver", "arbitrator"],
				},
				{
					name: "senderDisputeUnilateral",
					type: "unilateral",
					description: "Refund funds after timelock",
					script: this.senderDisputeUnilateralScript,
					signers: ["sender", "arbitrator"],
				},
				{
					name: "unilateralDirect",
					type: "unilateral",
					description: "Direct settlement after timelock",
					script: this.unilateralDirectScript,
					signers: ["sender", "receiver"],
				},
			];
		}

		/**
		 * Get the underlying SDK ScriptBuilder for advanced usage
		 */
		getScriptBuilder(): ScriptBuilder {
			return this.scriptBuilder;
		}
	}
}
