import { Inject, Injectable, Logger } from "@nestjs/common";
import { Signers, VEscrow } from "./escrow";
import {
	ArkAddress,
	ArkInfo,
	ArkTxInput,
	buildOffchainTx,
	CSVMultisigTapscript,
	RelativeTimelock,
	RestArkProvider,
	RestIndexerProvider,
	TapLeafScript,
	Transaction,
	VirtualCoin,
} from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import { TransactionOutput } from "@scure/btc-signer/psbt";

import { ARK_PROVIDER } from "./ark.constants";
import { Contract } from "../common/Contract.type";
import { ActionType } from "../common/Action.type";

export type EscrowTransactionForAction = {
	action: ActionType;
	receiverAddress: ArkAddress;
	receiverPublicKey: string;
	senderPublicKey: string;
	arbitratorPublicKey: string;
	contractNonce: string;
};
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

	createArkAddressForContract(contract: Contract): ArkAddress {
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
		return vtxos.filter(
			(_) =>
				// spentBy can be an empty string
				(_.spentBy?.length ?? 0) === 0,
		);
	}

	async createEscrowTransaction(
		transactionInput: EscrowTransactionForAction,
		vtxo: VirtualCoin,
	): Promise<EscrowTransaction> {
		if (this.arkInfo === undefined) {
			throw new Error("ARK info not loaded");
		}
		const script = ArkService.restoreScript(
			{
				...transactionInput,
			},
			this.arkInfo,
		);
		const spendingPath = ArkService.getSpendingPathForAction(
			script,
			transactionInput.action,
		);
		if (spendingPath === null) {
			throw new Error(`Invalid action: ${transactionInput.action}`);
		}

		const serverUnrollScript = CSVMultisigTapscript.decode(
			hex.decode(this.arkInfo.checkpointTapscript),
		);

		const outputs = ArkService.createOutputsForAction(
			transactionInput,
			vtxo.value,
		);

		// Create input from the contract VTXO
		const input: ArkTxInput = {
			txid: vtxo.txid,
			vout: vtxo.vout, // index
			value: vtxo.value,
			tapTree: script.encode(), // all spending conditions
			tapLeafScript: spendingPath, // Use the spending path directly, not .script property
		};

		this.logger.log(
			"Building offchain tx with input:",
			input.txid,
			"outputs:",
			outputs.length,
		);
		// Build the offchain transaction
		const { arkTx, checkpoints } = buildOffchainTx(
			[input],
			outputs,
			serverUnrollScript,
		);

		if (!arkTx || !checkpoints) {
			throw new Error("buildOffchainTx missing arkTx or checkpoints");
		}

		const requiredSigners = ArkService.getRequiredSignersForAction(
			script,
			transactionInput.action,
		);

		if (!requiredSigners) {
			throw new Error(`Required signers not found for action ${input}`);
		}

		return { arkTx, checkpoints, requiredSigners: requiredSigners };
	}

	async executeEscrowTransaction(transaction: EscrowTransaction) {
		if (this.arkInfo === undefined) {
			throw new Error("ARK info not loaded");
		}
		this.logger.log("Executing Ark transaction...");
		// The Ark transaction has been signed by each required party when they approved
		// Now we can submit the fully-signed transaction
		const arkTxData = transaction.arkTx.toPSBT();
		const arkTx = Transaction.fromPSBT(arkTxData, { allowUnknown: true });

		this.logger.log("Executing Ark transaction... PHASE 1");
		// Phase 1: Submit the signed Ark transaction and get checkpoint transactions
		const checkpointData = transaction.checkpoints.map((_) => _.toPSBT());
		const { arkTxid } = await this.provider.submitTx(
			base64.encode(arkTx.toPSBT()),
			checkpointData.map((c) => base64.encode(c)),
		);

		this.logger.log(`Successfully submitted Transaction ID:`, arkTxid);

		// Phase 2: Use the checkpoint transactions signed by each required party
		// (each user signed their checkpoints when they approved)
		console.log("Using pre-signed checkpoints for finalization...");
		const finalCheckpoints = checkpointData.map((c) => base64.encode(c));

		// Finalize the transaction
		await this.provider.finalizeTx(arkTxid, finalCheckpoints);
		console.log(`Successfully finalized tx with ID: ${arkTxid}`);
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

	static restoreScript(contract: Contract, arkInfo: ArkInfo): VEscrow.Script {
		return new VEscrow.Script({
			unilateralDelay: ArkService.getUnilateralDelay(arkInfo),
			receiver: hex.decode(contract.receiverPublicKey),
			sender: hex.decode(contract.senderPublicKey),
			arbitrator: hex.decode(contract.arbitratorPublicKey),
			server: hex.decode(ArkService.getServerKey(arkInfo)),
			nonce: new TextEncoder().encode(contract.contractNonce),
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
		action: ActionType,
	): TapLeafScript | null {
		switch (action) {
			case "release-funds":
				return escrowScript.releaseFunds();
			case "return-funds":
				return escrowScript.returnFunds();
			// this is the consensual settlement
			case "direct-settle":
				return escrowScript.direct();
			default:
				return null;
		}
	}

	static getRequiredSignersForAction(
		escrowScript: VEscrow.Script,
		action: ActionType,
	): Signers[] | undefined {
		const spendingPaths = escrowScript.getSpendingPaths();
		switch (action) {
			case "direct-settle": {
				return spendingPaths.find((_) => _.name === "direct")?.signers;
			}

			case "release-funds":
				return spendingPaths.find((_) => _.name === "releaseFunds")?.signers;

			case "return-funds":
				return spendingPaths.find((_) => _.name === "returnFunds")?.signers;

			default:
				throw new Error(`Unknown action: ${action}`);
		}
	}

	static createOutputsForAction(
		transactionInput: EscrowTransactionForAction,
		amount: number,
	): TransactionOutput[] {
		switch (transactionInput.action) {
			case "direct-settle": {
				return [
					{
						amount: BigInt(amount),
						script: ArkService.addressToScript(
							transactionInput.receiverAddress,
						),
					},
				];
			}

			default:
				throw new Error(`Unknown action: ${transactionInput.action}`);
		}
	}

	static addressToScript(address: ArkAddress): Uint8Array {
		return address.pkScript;
	}

	static decodeArkAddress(address: string): ArkAddress {
		try {
			return ArkAddress.decode(address);
		} catch (cause) {
			throw new Error("Failed to decode Ark address:", { cause });
		}
	}
}
