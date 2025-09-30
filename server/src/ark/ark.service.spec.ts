import { Test, MockFactory } from "@nestjs/testing";
import { ArkService } from "./ark.service";
import { Contract } from "../common/Contract.type";
import { ArkAddress, RestArkProvider } from "@arkade-os/sdk";
import { ModuleMocker } from "jest-mock";
import { VEscrow } from "./escrow";
import { ARK_PROVIDER } from "./ark.constants";
import { hex } from "@scure/base";

const moduleMocker = new ModuleMocker(global);
const mockArkAddress = () => ({});

describe("ArkService - createArkAddressForContract", () => {
	let arkService: ArkService;

	beforeEach(async () => {
		// jest.spyOn(ArkService, "restoreScript").mockImplementation(
		// 	() =>
		// 		({
		// 			address: jest.fn(
		// 				() => new ArkAddress(new Uint8Array(32), new Uint8Array(32), "ark"),
		// 			),
		// 		}) as unknown as VEscrow.Script,
		// );
		// ArkService.restoreScript = () =>
		// 	({
		// 		address: (prefix: string, key: Uint8Array) => {
		// 			return `${prefix}_${hex.encode(key)}`;
		// 		},
		// 	}) as unknown as VEscrow.Script;
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

		// arkService = new ArkService({
		// 	getInfo: jest.fn().mockResolvedValue({
		// 		version: "1.0",
		// 		network: "mainnet",
		// 		signerPubkey:
		// 			"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		// 		unilateralExitDelay: 300,
		// 	}),
		// 	serverUrl: "http://example.com",
		// } as unknown as RestArkProvider);

		// jest.spyOn(ArkService, "getAddrPrefix").mockReturnValue("ark");
		// jest
		// 	.spyOn(ArkService, "getServerKey")
		// 	.mockReturnValue(
		// 		"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		// 	);
	});

	it("should create an ArkAddress for the given contract", () => {
		const contract: Contract = {
			senderPublicKey:
				"bbc7fa7a8b2a185cb00f71b7e23b1fb7c753653221545be6e7b093142400f1f6",
			receiverPublicKey:
				"bbc7fa7a8b2a185cb00f71b7e23b1fb7c753653221545be6e7b093142400f1f7",
			arbitratorPublicKey:
				"bbc7fa7a8b2a185cb00f71b7e23b1fb7c753653221545be6e7b093142400f1f8",
		};

		const result = arkService.createArkAddressForContract(contract);

		expect(result).toBeInstanceOf(ArkAddress);
		expect(result.hrp).toBe("ark");
	});

	it("should throw an error if arkInfo is not loaded", () => {
		(arkService as any).arkInfo = undefined;

		const contract: Contract = {
			senderPublicKey:
				"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			receiverPublicKey:
				"fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
			arbitratorPublicKey:
				"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		};

		expect(() => {
			arkService.createArkAddressForContract(contract);
		}).toThrow("ARK info not loaded");
	});
});
