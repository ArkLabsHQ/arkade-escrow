import { Test } from "@nestjs/testing";
import { EscrowsContractsService } from "./escrows-contracts.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EscrowContract } from "./escrow-contract.entity";
import { ContractExecution } from "./contract-execution.entity";
import { ArkService } from "../../ark/ark.service";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ArkAddress } from "@arkade-os/sdk";

const ARBITRATOR_PUB_KEY = "mock_arbitrator_pubkey";

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
			if (key === "ARBITRATOR_PUB_KEY") return ARBITRATOR_PUB_KEY;
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
		const receiverPubkey = "pubkey-receiver";
		const senderPubkey = "pubkey-sender";
		const externalId = "contract-123";
		const initiatorArkAddress =
			"tark1qpt0syx7j0jspe69kldtljet0x9jz6ns4xw70m0w0xl30yfhn0mz6e9gu6zr3epntklwz8h330j8m03u27a4lqnc4dc7z829kxczves5stw760";
		const mockContract = {
			externalId: externalId,
			senderPubkey: senderPubkey,
			receiverPubkey: receiverPubkey,
			status: "funded",
			virtualCoins: [{ txid: "tx1", vout: 0, value: 1000 }],
			request: { externalId: "req-1" },
		};
		// Mock arkService.createEscrowTransaction
		const mockEscrowTx = {
			arkTx: "mock_ark_tx",
			checkpoints: ["cp1"],
			requiredSigners: ["sender", "receiver", "server"],
		};
		mockArkService.createEscrowTransaction.mockResolvedValue(mockEscrowTx);

		// Transaction without signatures!
		const cleanTransaction = {
			...mockEscrowTx,
			vtxo: mockContract.virtualCoins[0],
		};

		// Mock repository create and save
		const mockExecutionEntity = {
			externalId: "exec-1",
			contract: { externalId },
			cleanTransaction: {
				...cleanTransaction,
				approvedByPubKeys: [],
				rejectedByPubKeys: [],
			},
			status: "pending-initiator-signature",
			initiatedByPubKey: receiverPubkey,
		};

		beforeEach(() => {
			// Mock getOneForPartyAndStatus (via createQueryBuilder)
			const qbMock = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(mockContract),
			};
			mockContractRepository.createQueryBuilder.mockReturnValue(qbMock);
			mockContractExecutionRepository.create.mockReturnValue(
				mockExecutionEntity,
			);
			mockContractExecutionRepository.save.mockResolvedValue(
				mockExecutionEntity,
			);
		});

		it("should create a direct settlement execution successfully as a receiver", async () => {
			const initiatorPubKey = receiverPubkey;

			const result = await service.createDirectSettlementExecution(
				externalId,
				initiatorArkAddress,
				initiatorPubKey,
			);

			expect(result).toBeDefined();
			expect(result.externalId).toBe(mockExecutionEntity.externalId);
			// ALWAYS return clean transaction
			expect(result.arkTx).toBe(cleanTransaction.arkTx);
			expect(result.checkpoints).toBe(cleanTransaction.checkpoints);
			expect(result.vtxo).toEqual(mockContract.virtualCoins[0]);

			// Verify transaction creation
			expect(mockArkService.createEscrowTransaction).toHaveBeenCalledWith(
				{
					action: "direct-settle",
					receiverAddress: ArkAddress.decode(initiatorArkAddress),
					receiverPublicKey: receiverPubkey,
					senderPublicKey: senderPubkey,
					arbitratorPublicKey: ARBITRATOR_PUB_KEY,
					contractNonce: `${mockContract.externalId}${mockContract.request.externalId}`,
				},
				mockContract.virtualCoins[0],
			);

			// Verify contract execution creation
			expect(mockContractExecutionRepository.create).toHaveBeenCalledWith({
				action: "direct-settle",
				externalId: expect.stringMatching(/^.{16}$/),
				contract: { externalId: mockContract.externalId },
				initiatedByPubKey: initiatorPubKey,
				status: "pending-initiator-signature",
				cleanTransaction: {
					...cleanTransaction,
					approvedByPubKeys: [],
					rejectedByPubKeys: [],
				},
			});

			// Verify contract status update
			expect(mockContractRepository.update).toHaveBeenCalledWith(
				{ externalId },
				{ status: "pending-execution" },
			);
		});

		it("should create a direct settlement execution successfully as a sender", async () => {
			const initiatorPubKey = senderPubkey;

			const result = await service.createDirectSettlementExecution(
				externalId,
				initiatorArkAddress,
				initiatorPubKey,
			);

			expect(result).toBeDefined();
			expect(result.externalId).toBe(mockExecutionEntity.externalId);
			// ALWAYS return clean transaction
			expect(result.arkTx).toBe(cleanTransaction.arkTx);
			expect(result.checkpoints).toBe(cleanTransaction.checkpoints);
			expect(result.vtxo).toEqual(mockContract.virtualCoins[0]);

			// Verify transaction creation
			expect(mockArkService.createEscrowTransaction).toHaveBeenCalledWith(
				{
					action: "direct-settle",
					receiverAddress: ArkAddress.decode(initiatorArkAddress),
					receiverPublicKey: receiverPubkey,
					senderPublicKey: senderPubkey,
					arbitratorPublicKey: ARBITRATOR_PUB_KEY,
					contractNonce: `${mockContract.externalId}${mockContract.request.externalId}`,
				},
				mockContract.virtualCoins[0],
			);

			// Verify contract execution creation
			expect(mockContractExecutionRepository.create).toHaveBeenCalledWith({
				action: "direct-settle",
				externalId: expect.stringMatching(/^.{16}$/),
				contract: { externalId: mockContract.externalId },
				initiatedByPubKey: initiatorPubKey,
				status: "pending-initiator-signature",
				cleanTransaction: {
					...cleanTransaction,
					approvedByPubKeys: [],
					rejectedByPubKeys: [],
				},
			});

			// Verify contract status update
			expect(mockContractRepository.update).toHaveBeenCalledWith(
				{ externalId },
				{ status: "pending-execution" },
			);
		});
	});
});
