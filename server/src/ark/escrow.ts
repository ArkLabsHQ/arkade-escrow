import { Bytes, hash160 } from "@scure/btc-signer/utils";
import { hex } from "@scure/base";
import { Script as ScriptClass } from "@scure/btc-signer";
import { VtxoScript, TapLeafScript, ConditionMultisigTapscript } from "@arkade-os/sdk";
import {
	MultisigTapscript,
	CSVMultisigTapscript,
	RelativeTimelock,
} from "@arkade-os/sdk";

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
	 * Validates the escrow contract options
	 */
	function validateOptions(options: Options): void {
		const { sender, receiver, arbitrator, server } = options;

		// Validate public key lengths
		const keys = [
			{ name: "sender", key: sender },
			{ name: "receiver", key: receiver },
			{ name: "arbitrator", key: arbitrator },
			{ name: "server", key: server },
		];

		for (const { name, key } of keys) {
			if (key.length !== 32) {
				throw new Error(
					`Invalid ${name} public key length: expected 32, got ${key.length}`,
				);
			}
		}

		// Ensure all parties are unique
		const keySet = new Set([
			hex.encode(sender),
			hex.encode(receiver),
			hex.encode(arbitrator),
			hex.encode(server),
		]);

		if (keySet.size !== 4) {
			throw new Error("All parties must have unique public keys");
		}

		if (options.nonce && options.nonce.length < 32) {
			throw new Error(
				`Invalid nonce length: expected 32 or more, got ${options.nonce?.length}`,
			);
		}


	}
	

	/**
	 * Virtual Escrow Contract Script implementation
	 *
	 * Provides 6 spending paths:
	 * - Collaborative (with server): release, refund, direct
	 * - Unilateral (with timelock): unilateralRelease, unilateralRefund, unilateralDirect
	 */
	export class Script extends VtxoScript {
		readonly receiverDisputeScript: string;
		readonly senderDisputeScript: string;
		readonly directScript: string;
		readonly receiverDisputeUnilateralScript: string;
		readonly senderDisputeUnilateralScript: string;
		readonly unilateralDirectScript: string;
		readonly ghostScript?: string;

		constructor(readonly options: Options) {
			validateOptions(options);

			const { sender, receiver, arbitrator, server, unilateralDelay, nonce } = options;

			// Collaborative spending paths (with server)
			const releaseScript = MultisigTapscript.encode({
				pubkeys: [receiver, arbitrator, server],
			}).script;

			const refundScript = MultisigTapscript.encode({
				pubkeys: [sender, arbitrator, server],
			}).script;

			// the happy path - transaction occurred as expected
			const directScript = 
				MultisigTapscript.encode({
					pubkeys: [sender, receiver, server],
				}).script;
	

			// Unilateral spending paths (with timelock)
			const unilateralReleaseScript = CSVMultisigTapscript.encode({
				pubkeys: [receiver, arbitrator],
				timelock: unilateralDelay,
			}).script;

			const unilateralRefundScript = CSVMultisigTapscript.encode({
				pubkeys: [sender, arbitrator],
				timelock: unilateralDelay,
			}).script;

			const unilateralDirectScript = CSVMultisigTapscript.encode({
				pubkeys: [sender, receiver],
				timelock: unilateralDelay,
			}).script;

			const ghostScript = nonce ?
				ConditionMultisigTapscript.encode({
					pubkeys: [sender, receiver, arbitrator, server],
					conditionScript: ScriptClass.encode(["HASH160", hash160(nonce), "EQUAL"]),
				}).script :
				undefined;

			// Initialize the VtxoScript with all spending paths
			super([
				releaseScript,
				refundScript,
				directScript,
				unilateralReleaseScript,
				unilateralRefundScript,
				unilateralDirectScript,
				...ghostScript ? [ghostScript] : [],
			]);

			// Store hex-encoded scripts for easy access
			this.receiverDisputeScript = hex.encode(releaseScript);
			this.senderDisputeScript = hex.encode(refundScript);
			this.directScript = hex.encode(directScript);
			this.receiverDisputeUnilateralScript = hex.encode(
				unilateralReleaseScript,
			);
			this.senderDisputeUnilateralScript = hex.encode(unilateralRefundScript);
			this.unilateralDirectScript = hex.encode(unilateralDirectScript);
			this.ghostScript = ghostScript ? hex.encode(ghostScript) : undefined;
		}

		/**
		 * Get the tap leaf script for collaborative release path
		 * (receiver + arbitrator + server)
		 */
		receiverDispute(): TapLeafScript {
			return this.findLeaf(this.receiverDisputeScript);
		}

		/**
		 * Get the tap leaf script for collaborative refund path
		 * (sender + arbitrator + server)
		 */
		senderDispute(): TapLeafScript {
			return this.findLeaf(this.senderDisputeScript);
		}

		/**
		 * Get the tap leaf script for collaborative direct path
		 * (sender + receiver + server)
		 */
		direct(): TapLeafScript {
			return this.findLeaf(this.directScript);
		}

		/**
		 * Get the tap leaf script for unilateral release path
		 * (receiver + arbitrator after timelock)
		 */
		receiverDisputeUnilateral(): TapLeafScript {
			return this.findLeaf(this.receiverDisputeUnilateralScript);
		}

		/**
		 * Get the tap leaf script for unilateral refund path
		 * (sender + arbitrator after timelock)
		 */
		senderDisputeUniteral(): TapLeafScript {
			return this.findLeaf(this.senderDisputeUnilateralScript);
		}

		/**
		 * Get the tap leaf script for unilateral direct path
		 * (sender + receiver after timelock)
		 */
		unilateralDirect(): TapLeafScript {
			return this.findLeaf(this.unilateralDirectScript);
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
					name: "receiverDispute", // receiver dispute
					type: "collaborative",
					description: "Release funds to receiver (goods delivered)",
					script: this.receiverDisputeScript,
					signers: ["receiver", "arbitrator", "server"],
				},
				{
					name: "senderDispute", // sender dispute
					type: "collaborative",
					description: "Refund funds to sender (dispute resolved)",
					script: this.senderDisputeScript,
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
	}
}
