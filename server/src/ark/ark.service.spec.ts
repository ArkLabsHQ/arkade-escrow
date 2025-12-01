import { Test } from "@nestjs/testing";
import { ArkService } from "./ark.service";
import { Contract } from "../common/Contract.type";
import { ArkAddress } from "@arkade-os/sdk";
import { ARK_PROVIDER, INDEXER_PROVIDER } from "./ark.constants";

describe("ArkService", () => {
	const requestId = "wpx33cfx0zru7xf5";
	const contractId = "xMXl8-IbHmt0p-FE";
	const contract: Contract = {
		senderPublicKey:
			"bb0a20da2015e33bd75e25100979ea7f7d3eab06e774f83ef0b9cd7ac5a77042",
		receiverPublicKey:
			"c8462d0e7e3bbfc1751df0d040e43c4aef37e17b554a8112849a94775bb50497",
		arbitratorPublicKey:
			"86f5d11162ab25c88f4af9cc4224161a40a6e029a45beb8459f0f5f5a95f66d8",
		contractNonce: `${contractId}${requestId}`,
	};
	let arkService: ArkService;

	beforeEach(async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [ArkService],
		})
			.useMocker((token) => {
				if (token === ARK_PROVIDER) {
					return {
						getInfo: jest.fn().mockResolvedValue({
							version: "1.0",
							network: "mainnet",
							signerPubkey:
								"03bbc7fa7a8b2a185cb00f71b7e23b1fb7c753653221545be6e7b093142400f1f5",
							unilateralExitDelay: 300,
						}),
						serverUrl: "http://example.com",
					};
				}
				if (token === INDEXER_PROVIDER) {
					return {
						getVtxos: jest.fn().mockResolvedValue({
							vtxos: [
								{
									txid: "829e94bb858f0eec18633ec15f98e9c908bf7dac95242297e49c6cfdc8dfdee5",
									vout: 0,
									value: 1992,
									status: { confirmed: false },
									virtualStatus: {
										state: "preconfirmed",
										commitmentTxIds: [
											"e82d43ebcd0f2470231a299ece25cf2e08fc9af029ddcd85310e9f072e5bc534",
										],
										batchExpiry: 1761927878000,
									},
									spentBy: "",
									settledBy: "",
									arkTxId: "",
									createdAt: "2025-10-31T13:27:02.000Z",
									isUnrolled: false,
									isSpent: false,
								},
								{
									txid: "13113fbe78bf8a21b23d6aa2da3709c09b5fbb9fb6f6ef0ef7ea7ec0327eb208",
									vout: 0,
									value: 1000,
									status: { confirmed: false },
									virtualStatus: {
										state: "preconfirmed",
										commitmentTxIds: [
											"9c115688c6b225e82e45c5ee831f2191ec02905e1f81a9cd5d79b05551d0fc6b",
										],
										batchExpiry: 1762262738000,
									},
									spentBy: "adsf",
									settledBy: "",
									arkTxId: "",
									createdAt: "2025-11-04T10:07:20.000Z",
									isUnrolled: false,
									isSpent: true,
								},
							],
							page: {},
						}),
					};
				}
			})
			.compile();
		arkService = moduleRef.get(ArkService);
		arkService.onModuleInit();
	});

	describe("createArkAddressForContract", () => {
		it("should create an ArkAddress for the given contract", () => {
			const result = arkService.createArkAddressForContract(contract);
			expect(result).toBeInstanceOf(ArkAddress);
			expect(result.hrp).toBe("tark");
		});
	});

	describe("getSpendableVtxoForContract", () => {
		const arkAddress = ArkAddress.decode(
			"tark1qpt0syx7j0jspe69kldtljet0x9jz6ns4xw70m0w0xl30yfhn0mz6e9gu6zr3epntklwz8h330j8m03u27a4lqnc4dc7z829kxczves5stw760",
		);
		it("returns only unspent VTXO for a given contract", async () => {
			const vtxo = await arkService.getSpendableVtxoForContract(arkAddress);
			expect(vtxo.length).toBe(1);
		});
	});
});
