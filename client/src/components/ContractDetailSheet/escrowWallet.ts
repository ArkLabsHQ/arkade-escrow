import { ArkAddress } from "@arkade-os/sdk";
import { TransactionInput, TransactionOutput } from "@scure/btc-signer/psbt.js";

export class EscrowWallet {
	/*
    1. craft the transaction
    2. submit to ark provider
    3. sign the checkpoints
    4. finalize the tx
    5. listen for the tx to be confirmed
    6. return the txid
 */
	constructor() {}

	/**
	 *
	 * @param address
	 * @param amount
	 * @thows Error if invalid address
	 * @returns
	 */
	buildTransaction({ address, amount }: { address: string; amount: number }) {
		if (amount <= 0) {
			throw new Error("Amount must be positive");
		}
		// TODO: check subdust
		const outputAddress = ArkAddress.decode(address);
		const outputScript = outputAddress.pkScript;
		const outputs: TransactionOutput[] = [
			{
				script: outputScript,
				amount: BigInt(amount),
			},
		];
	}
}

// async sendBitcoin(params: SendBitcoinParams): Promise<string> {

//
// // add change output if needed
// if (selected.changeAmount > 0n) {
//     const changeOutputScript =
//         selected.changeAmount < this.dustAmount
//             ? this.arkAddress.subdustPkScript
//             : this.arkAddress.pkScript;
//
//     outputs.push({
//         script: changeOutputScript,
//         amount: BigInt(selected.changeAmount),
//     });
// }
//
// const tapTree = this.offchainTapscript.encode();
// const offchainTx = buildOffchainTx(
//     selected.inputs.map((input) => ({
//         ...input,
//         tapLeafScript: selectedLeaf,
//         tapTree,
//     })),
//     outputs,
//     this.serverUnrollScript
// );
//
// const signedVirtualTx = await this.identity.sign(offchainTx.arkTx);
//
// const { arkTxid, signedCheckpointTxs } =
//     await this.arkProvider.submitTx(
//         base64.encode(signedVirtualTx.toPSBT()),
//         offchainTx.checkpoints.map((c) => base64.encode(c.toPSBT()))
//     );
//
// // sign the checkpoints
// const finalCheckpoints = await Promise.all(
//     signedCheckpointTxs.map(async (c) => {
//         const tx = Transaction.fromPSBT(base64.decode(c));
//         const signedCheckpoint = await this.identity.sign(tx);
//         return base64.encode(signedCheckpoint.toPSBT());
//     })
// );
//
// await this.arkProvider.finalizeTx(arkTxid, finalCheckpoints);
//
// try {
//     // mark VTXOs as spent and optionally add the change VTXO
//     const spentVtxos: ExtendedVirtualCoin[] = [];
//     const commitmentTxIds = new Set<string>();
//     let batchExpiry: number = Number.MAX_SAFE_INTEGER;
//
//     for (const [inputIndex, input] of selected.inputs.entries()) {
//         const vtxo = extendVirtualCoin(this, input);
//
//         const checkpointB64 = signedCheckpointTxs[inputIndex];
//         const checkpoint = Transaction.fromPSBT(
//             base64.decode(checkpointB64)
//         );
//
//         spentVtxos.push({
//             ...vtxo,
//             virtualStatus: { ...vtxo.virtualStatus, state: "spent" },
//             spentBy: checkpoint.id,
//             arkTxId: arkTxid,
//             isSpent: true,
//         });
//
//         if (vtxo.virtualStatus.commitmentTxIds) {
//             for (const commitmentTxId of vtxo.virtualStatus
//                 .commitmentTxIds) {
//                 commitmentTxIds.add(commitmentTxId);
//             }
//         }
//         if (vtxo.virtualStatus.batchExpiry) {
//             batchExpiry = Math.min(
//                 batchExpiry,
//                 vtxo.virtualStatus.batchExpiry
//             );
//         }
//     }
//
//     const createdAt = Date.now();
//     const addr = this.arkAddress.encode();
//
//     if (
//         selected.changeAmount > 0n &&
//         batchExpiry !== Number.MAX_SAFE_INTEGER
//     ) {
//         const changeVtxo: ExtendedVirtualCoin = {
//             txid: arkTxid,
//             vout: outputs.length - 1,
//             createdAt: new Date(createdAt),
//             forfeitTapLeafScript: this.offchainTapscript.forfeit(),
//             intentTapLeafScript: this.offchainTapscript.forfeit(),
//             isUnrolled: false,
//             isSpent: false,
//             tapTree: this.offchainTapscript.encode(),
//             value: Number(selected.changeAmount),
//             virtualStatus: {
//                 state: "preconfirmed",
//                 commitmentTxIds: Array.from(commitmentTxIds),
//                 batchExpiry,
//             },
//             status: {
//                 confirmed: false,
//             },
//         };
//
//         await this.walletRepository.saveVtxos(addr, [changeVtxo]);
//     }
//
//     await this.walletRepository.saveVtxos(addr, spentVtxos);
//     await this.walletRepository.saveTransactions(addr, [
//         {
//             key: {
//                 boardingTxid: "",
//                 commitmentTxid: "",
//                 arkTxid: arkTxid,
//             },
//             amount: params.amount,
//             type: TxType.TxSent,
//             settled: false,
//             createdAt: Date.now(),
//         },
//     ]);
// } catch (e) {
//     console.warn("error saving offchain tx to repository", e);
// } finally {
//     return arkTxid;
// }
// }
