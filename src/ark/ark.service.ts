import { Inject, Injectable, Logger } from "@nestjs/common";
import { Signers, VEscrow } from "./escrow";
import {
	ArkAddress,
	ArkInfo,
	buildOffchainTx,
	CSVMultisigTapscript,
	RelativeTimelock,
	RestArkProvider,
	RestIndexerProvider,
	TapLeafScript,
	Transaction,
	VirtualCoin,
} from "@arkade-os/sdk";
import { hex } from "@scure/base";
import { TransactionOutput } from "@scure/btc-signer/psbt";

import { ARK_PROVIDER } from "./ark.constants";

export type EscrowContract = {
	receiver: { pubKey: string };
	sender: { pubKey: string };
	arbitrator: { pubKey: string };
};
export type EscrowContractWithAddress = {
	receiver: { pubKey: string; address: string };
	sender: { pubKey: string; address: string };
	arbitrator: { pubKey: string };
};
export type Action = "release" | "refund" | "direct-settle";
export type EscrowTransaction = {
	arkTx: Transaction;
	checkpoints: Transaction[];
	requiredSigners: Signers[];
};

@Injectable()
export class ArkService {
	private readonly logger = new Logger(ArkService.name);
	private arkInfo: ArkInfo | undefined;
	private indexerProvider?: RestIndexerProvider = undefined;

	constructor(
		@Inject(ARK_PROVIDER) private readonly provider: RestArkProvider,
	) {}

	async onModuleInit() {
		try {
			this.arkInfo = await this.provider.getInfo();
			this.logger.log(
				`ARK provider version ${this.arkInfo.version} connected to ${this.arkInfo.network}`,
			);
			this.indexerProvider = new RestIndexerProvider(this.provider.serverUrl);
		} catch (cause) {
			throw new Error("Failed to connect to Ark provider", { cause });
		}
	}

	async onModuleDestroy() {
		// TODO: anything to clean up on Ark side?
	}

	createArkAddressForContract(contract: EscrowContract): ArkAddress {
		if (this.arkInfo === undefined) {
			throw new Error("ARK info not loaded");
		}
		const escrowScript = ArkService.restoreScript(contract, this.arkInfo);
		const addrPrefix = ArkService.getAddrPrefix(this.arkInfo);
		const serverKey = ArkService.getServerKey(this.arkInfo);
		const arkAddress = escrowScript.address(addrPrefix, hex.decode(serverKey));
		return arkAddress;
	}

	async getSpendableVtxoForContract(
		address: ArkAddress,
	): Promise<VirtualCoin[]> {
		if (this.indexerProvider === undefined) {
			throw new Error("RestIndexerProvider not ready");
		}
		const script = hex.encode(address.pkScript);
		const vtxos = await ArkService.getVtxosForScript(
			script,
			this.indexerProvider,
		);
		return vtxos.filter((_) => _.spentBy === undefined);
	}

	async createEscrowTransaction(
		contract: EscrowContractWithAddress,
		action: Action,
		vtxo: VirtualCoin,
	): Promise<EscrowTransaction> {
		if (this.arkInfo === undefined) {
			throw new Error("ARK info not loaded");
		}
		const script = ArkService.restoreScript(contract, this.arkInfo);
		const spendingPath = ArkService.getSpendingPathForAction(script, action);
		if (spendingPath === null) {
			throw new Error(`Invalid action: ${action}`);
		}

		// Create server unroll script for checkpoint transactions
		const serverKey = ArkService.getServerKey(this.arkInfo);
		const unilateralDelay = ArkService.getUnilateralDelay(this.arkInfo);

		const serverUnrollScript = CSVMultisigTapscript.encode({
			pubkeys: [hex.decode(serverKey)],
			timelock: unilateralDelay,
		});

		// Create input from the contract VTXO
		const input = {
			txid: vtxo.txid,
			vout: vtxo.vout, // index
			value: vtxo.value,
			script: script.pkScript,
			tapTree: script.encode(),
			tapLeafScript: spendingPath, // Use the spending path directly, not .script property
		};

		const outputs = ArkService.createOutputsForAction(
			action,
			contract,
			vtxo.value,
		);
		this.logger.log(
			"Building offchain tx with input:",
			input.txid,
			"outputs:",
			outputs.length,
		);
		// Build the offchain transaction
		const result = buildOffchainTx([input], outputs, serverUnrollScript);

		this.logger.debug("buildOffchainTx result:", result);

		// TODO: this part seems to be debugging the SDK
		if (!result || typeof result !== "object") {
			throw new Error("buildOffchainTx returned invalid result");
		}

		const { arkTx, checkpoints } = result;

		if (!arkTx || !checkpoints) {
			throw new Error("buildOffchainTx missing arkTx or checkpoints");
		}
		// TODO: end

		const requiredSigners = ArkService.getRequiredSignersForAction(
			script,
			action,
		);

		if (!requiredSigners) {
			throw new Error(`Required signers not found for action ${action}`);
		}

		return { arkTx, checkpoints, requiredSigners: requiredSigners };
	}

	static async getVtxosForScript(
		script: string,
		indexerProvider: RestIndexerProvider,
		currentVtxos: VirtualCoin[] = [],
	): Promise<VirtualCoin[]> {
		const { vtxos, page } = await indexerProvider.getVtxos({
			scripts: [script],
		});
		const nextVtxos = currentVtxos.concat(vtxos);
		if (page?.next) {
			return ArkService.getVtxosForScript(script, indexerProvider, nextVtxos);
		}
		return nextVtxos;
	}

	static restoreScript(
		contract: EscrowContract,
		arkInfo: ArkInfo,
	): VEscrow.Script {
		return new VEscrow.Script({
			unilateralDelay: ArkService.getUnilateralDelay(arkInfo),
			receiver: hex.decode(contract.receiver.pubKey),
			sender: hex.decode(contract.sender.pubKey),
			arbitrator: hex.decode(contract.arbitrator.pubKey),
			server: hex.decode(ArkService.getServerKey(arkInfo)),
		});
	}

	static getUnilateralDelay(arkInfo: ArkInfo): RelativeTimelock {
		return {
			type: arkInfo.unilateralExitDelay < 512 ? "blocks" : "seconds",
			value: arkInfo.unilateralExitDelay,
		};
	}

	static getServerKey(arkInfo: ArkInfo): string {
		return arkInfo.signerPubkey.slice(2);
	}

	static getAddrPrefix(arkInfo: ArkInfo): string {
		return arkInfo.network === "mainnet" ? "ark" : "tark";
	}

	static getSpendingPathForAction(
		escrowScript: VEscrow.Script,
		action: Action,
	): TapLeafScript | null {
		switch (action) {
			case "release":
				return escrowScript.release();
			case "refund":
				return escrowScript.refund();
			case "direct-settle":
				return escrowScript.direct();
			default:
				return null;
		}
	}

	static getRequiredSignersForAction(
		escrowScript: VEscrow.Script,
		action: Action,
	): Signers[] | undefined {
		const spendingPaths = escrowScript.getSpendingPaths();
		switch (action) {
			case "release":
				return spendingPaths.find((_) => _.name === "release")?.signers;

			case "refund":
				// Send all funds to sender
				return spendingPaths.find((_) => _.name === "refund")?.signers;

			case "direct-settle": {
				return spendingPaths.find((_) => _.name === "direct")?.signers;
			}

			default:
				throw new Error(`Unknown action: ${action}`);
		}
	}

	static createOutputsForAction(
		action: Action,
		contract: EscrowContractWithAddress,
		amount: number,
	): TransactionOutput[] {
		switch (action) {
			case "release":
				// Send all funds to receiver
				return [
					{
						amount: BigInt(amount),
						script: ArkService.addressToScript(contract.receiver.address),
					},
				];

			case "refund":
				// Send all funds to sender
				return [
					{
						amount: BigInt(amount),
						script: ArkService.addressToScript(contract.sender.address),
					},
				];

			case "direct-settle": {
				// Split 50/50 between sender and receiver
				const halfAmount = Math.floor(amount / 2);
				return [
					{
						amount: BigInt(halfAmount),
						script: ArkService.addressToScript(contract.sender.address),
					},
					{
						amount: BigInt(amount - halfAmount), // Remaining amount to avoid rounding issues
						script: ArkService.addressToScript(contract.receiver.address),
					},
				];
			}

			default:
				throw new Error(`Unknown action: ${action}`);
		}
	}

	static addressToScript(address: string): Uint8Array {
		try {
			// Decode the Ark address to get the script
			const arkAddress = ArkAddress.decode(address);
			return arkAddress.pkScript;
		} catch (cause) {
			// Fallback: if it's already a hex string, try to decode it
			if (address.length % 2 === 0) {
				try {
					return hex.decode(address);
				} catch (hexError) {
					throw new Error("Failed to hex decode address:", { cause: hexError });
				}
			}
			throw new Error(`Cannot convert address to script: ${address}`, {
				cause,
			});
		}
	}
}
