import { Test } from "@nestjs/testing";
import { EscrowsContractsService } from "./escrows-contracts.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EscrowContract } from "./escrow-contract.entity";
import { ContractExecution } from "./contract-execution.entity";
import { ArkService } from "../../ark/ark.service";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

describe("EscrowsContractsService", () => {
	let service: EscrowsContractsService;
	let contractRepository: any;
	let contractExecutionRepository: any;
	let arkService: any;

	const mockContractRepository = {
		createQueryBuilder: jest.fn(),
		update: jest.fn(),
	};

	const mockContractExecutionRepository = {
		create: jest.fn(),
		save: jest.fn(),
	};

	const mockArkService = {
		createEscrowTransaction: jest.fn(),
	};

	const mockConfigService = {
		get: jest.fn((key) => {
			if (key === "ARBITRATOR_PUB_KEY") return "mock_arbitrator_pubkey";
			return null;
		}),
	};

	beforeEach(async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [EscrowsContractsService],
		})
			.useMocker((token) => {
				if (token === getRepositoryToken(EscrowContract)) {
					return mockContractRepository;
				}
				if (token === getRepositoryToken(ContractExecution)) {
					return mockContractExecutionRepository;
				}
				if (token === ArkService) {
					return mockArkService;
				}
				if (token === ConfigService) {
					return mockConfigService;
				}
				if (token === EventEmitter2) {
					return { emit: jest.fn() };
				}
			})
			.compile();

		service = moduleRef.get(EscrowsContractsService);
		contractRepository = moduleRef.get(getRepositoryToken(EscrowContract));
		contractExecutionRepository = moduleRef.get(
			getRepositoryToken(ContractExecution),
		);
		arkService = moduleRef.get(ArkService);

		jest.clearAllMocks();
	});

	describe("createDirectSettlementExecution", () => {
		it("should create a direct settlement execution successfully", async () => {
			const externalId = "contract-123";
			const initiatorArkAddress =
				"tark1qpt0syx7j0jspe69kldtljet0x9jz6ns4xw70m0w0xl30yfhn0mz6e9gu6zr3epntklwz8h330j8m03u27a4lqnc4dc7z829kxczves5stw760";
			const initiatorPubKey = "pubkey-receiver";

			const mockContract = {
				externalId: externalId,
				senderPubkey: initiatorPubKey,
				receiverPubkey: "pubkey-sender",
				status: "funded",
				virtualCoins: [{ txid: "tx1", vout: 0, value: 1000 }],
				request: { externalId: "req-1" },
			};

			// Mock getOneForPartyAndStatus (via createQueryBuilder)
			const qbMock = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(mockContract),
			};
			mockContractRepository.createQueryBuilder.mockReturnValue(qbMock);

			// Mock arkService.createEscrowTransaction
			const mockEscrowTx = {
				arkTx: "mock_ark_tx",
				checkpoints: ["cp1"],
				requiredSigners: [],
			};
			mockArkService.createEscrowTransaction.mockResolvedValue(mockEscrowTx);

			// Mock repository create and save
			const mockExecutionEntity = {
				externalId: "exec-1",
				contract: { externalId },
				cleanTransaction: {
					arkTx: mockEscrowTx.arkTx,
					checkpoints: mockEscrowTx.checkpoints,
					vtxo: mockContract.virtualCoins[0],
				},
				status: "pending-initiator-signature",
				initiatedByPubKey: initiatorPubKey,
			};
			mockContractExecutionRepository.create.mockReturnValue(
				mockExecutionEntity,
			);
			mockContractExecutionRepository.save.mockResolvedValue(
				mockExecutionEntity,
			);

			const result = await service.createDirectSettlementExecution(
				externalId,
				initiatorArkAddress,
				initiatorPubKey,
			);

			expect(result).toBeDefined();
			expect(result.externalId).toBe("exec-1");
			expect(result.arkTx).toBe(mockEscrowTx.arkTx);
			expect(result.vtxo).toEqual(mockContract.virtualCoins[0]);

			// Verify contract status update
			expect(mockContractRepository.update).toHaveBeenCalledWith(
				{ externalId },
				{ status: "pending-execution" },
			);

			// Verify ark service call
			expect(mockArkService.createEscrowTransaction).toHaveBeenCalled();
		});
	});
});
