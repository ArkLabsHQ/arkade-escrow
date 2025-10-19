import { Test } from "@nestjs/testing";
import { ArkService } from "./ark.service";
import { Contract } from "../common/Contract.type";
import { ArkAddress } from "@arkade-os/sdk";
import { ARK_PROVIDER } from "./ark.constants";

describe("ArkService - createArkAddressForContract", () => {
	const requestId = "wpx33cfx0zru7xf5";
	const contractId = "xMXl8-IbHmt0p-FE";

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
			})
			.compile();
		arkService = moduleRef.get(ArkService);
		arkService.onModuleInit();
	});

	it.skip("should create an ArkAddress for the given contract", () => {
		const contract: Contract = {
			senderPublicKey:
				"bbc7fa7a8b2a185cb00f71b7e23b1fb7c753653221545be6e7b093142400f1f6",
			receiverPublicKey:
				"bbc7fa7a8b2a185cb00f71b7e23b1fb7c753653221545be6e7b093142400f1f7",
			arbitratorPublicKey:
				"bbc7fa7a8b2a185cb00f71b7e23b1fb7c753653221545be6e7b093142400f1f8",
			contractNonce: `${contractId}${requestId}`,
		};

		const result = arkService.createArkAddressForContract(contract);

		expect(result).toBeInstanceOf(ArkAddress);
		expect(result.hrp).toBe("ark");
	});

	it("should throw an error if arkInfo is not loaded", () => {
		// biome-ignore lint/suspicious/noExplicitAny: test
		(arkService as any).arkInfo = undefined;

		const contract: Contract = {
			senderPublicKey:
				"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			receiverPublicKey:
				"fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
			arbitratorPublicKey:
				"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			contractNonce: `${contractId}${requestId}`,
		};

		expect(() => {
			arkService.createArkAddressForContract(contract);
		}).toThrow("ARK info not loaded");
	});
});
