import { Bytes } from "@scure/btc-signer/utils";
import { hex } from "@scure/base";
import { VtxoScript, TapLeafScript } from "@arkade-os/sdk";
import {
	MultisigTapscript,
	CSVMultisigTapscript,
	RelativeTimelock,
} from "@arkade-os/sdk";

/**
 * Virtual Escrow Contract (VEC) namespace containing types and implementation
 * for a 3-party escrow contract with a buyer, seller, and arbitrator.
 */
export namespace VEscrow {
	/**
	 * Configuration options for the escrow contract
	 */
	export interface Options {
		/** Buyer's x-only public key */
		buyer: Bytes;
		/** Seller's x-only public key */
		seller: Bytes;
		/** Arbitrator's x-only public key */
		arbitrator: Bytes;
		/** Ark server's x-only public key */
		server: Bytes;
		/** Unilateral delay for unilateral paths */
		unilateralDelay: RelativeTimelock;
	}

	/**
	 * Validates the escrow contract options
	 */
	function validateOptions(options: Options): void {
		const { buyer, seller, arbitrator, server } = options;

		// Validate public key lengths
		const keys = [
			{ name: "buyer", key: buyer },
			{ name: "seller", key: seller },
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
			hex.encode(buyer),
			hex.encode(seller),
			hex.encode(arbitrator),
			hex.encode(server),
		]);

		if (keySet.size !== 4) {
			throw new Error("All parties must have unique public keys");
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
		readonly releaseScript: string;
		readonly refundScript: string;
		readonly directScript: string;
		readonly unilateralReleaseScript: string;
		readonly unilateralRefundScript: string;
		readonly unilateralDirectScript: string;

		constructor(readonly options: Options) {
			validateOptions(options);

			const { buyer, seller, arbitrator, server, unilateralDelay } = options;

			// Collaborative spending paths (with server)
			const releaseScript = MultisigTapscript.encode({
				pubkeys: [seller, arbitrator, server],
			}).script;

			const refundScript = MultisigTapscript.encode({
				pubkeys: [buyer, arbitrator, server],
			}).script;

			const directScript = MultisigTapscript.encode({
				pubkeys: [buyer, seller, server],
			}).script;

			// Unilateral spending paths (with timelock)
			const unilateralReleaseScript = CSVMultisigTapscript.encode({
				pubkeys: [seller, arbitrator],
				timelock: unilateralDelay,
			}).script;

			const unilateralRefundScript = CSVMultisigTapscript.encode({
				pubkeys: [buyer, arbitrator],
				timelock: unilateralDelay,
			}).script;

			const unilateralDirectScript = CSVMultisigTapscript.encode({
				pubkeys: [buyer, seller],
				timelock: unilateralDelay,
			}).script;

			// Initialize the VtxoScript with all spending paths
			super([
				releaseScript,
				refundScript,
				directScript,
				unilateralReleaseScript,
				unilateralRefundScript,
				unilateralDirectScript,
			]);

			// Store hex-encoded scripts for easy access
			this.releaseScript = hex.encode(releaseScript);
			this.refundScript = hex.encode(refundScript);
			this.directScript = hex.encode(directScript);
			this.unilateralReleaseScript = hex.encode(unilateralReleaseScript);
			this.unilateralRefundScript = hex.encode(unilateralRefundScript);
			this.unilateralDirectScript = hex.encode(unilateralDirectScript);
		}

		/**
		 * Get the tap leaf script for collaborative release path
		 * (seller + arbitrator + server)
		 */
		release(): TapLeafScript {
			return this.findLeaf(this.releaseScript);
		}

		/**
		 * Get the tap leaf script for collaborative refund path
		 * (buyer + arbitrator + server)
		 */
		refund(): TapLeafScript {
			return this.findLeaf(this.refundScript);
		}

		/**
		 * Get the tap leaf script for collaborative direct path
		 * (buyer + seller + server)
		 */
		direct(): TapLeafScript {
			return this.findLeaf(this.directScript);
		}

		/**
		 * Get the tap leaf script for unilateral release path
		 * (seller + arbitrator after timelock)
		 */
		unilateralRelease(): TapLeafScript {
			return this.findLeaf(this.unilateralReleaseScript);
		}

		/**
		 * Get the tap leaf script for unilateral refund path
		 * (buyer + arbitrator after timelock)
		 */
		unilateralRefund(): TapLeafScript {
			return this.findLeaf(this.unilateralRefundScript);
		}

		/**
		 * Get the tap leaf script for unilateral direct path
		 * (buyer + seller after timelock)
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
			signers: string[];
		}> {
			return [
				{
					name: "release",
					type: "collaborative",
					description: "Release funds to seller (goods delivered)",
					script: this.releaseScript,
					signers: ["seller", "arbitrator", "server"],
				},
				{
					name: "refund",
					type: "collaborative",
					description: "Refund funds to buyer (dispute resolved)",
					script: this.refundScript,
					signers: ["buyer", "arbitrator", "server"],
				},
				{
					name: "direct",
					type: "collaborative",
					description: "Direct settlement between parties",
					script: this.directScript,
					signers: ["buyer", "seller", "server"],
				},
				{
					name: "unilateralRelease",
					type: "unilateral",
					description: "Release funds after timelock",
					script: this.unilateralReleaseScript,
					signers: ["seller", "arbitrator"],
				},
				{
					name: "unilateralRefund",
					type: "unilateral",
					description: "Refund funds after timelock",
					script: this.unilateralRefundScript,
					signers: ["buyer", "arbitrator"],
				},
				{
					name: "unilateralDirect",
					type: "unilateral",
					description: "Direct settlement after timelock",
					script: this.unilateralDirectScript,
					signers: ["buyer", "seller"],
				},
			];
		}
	}
}
