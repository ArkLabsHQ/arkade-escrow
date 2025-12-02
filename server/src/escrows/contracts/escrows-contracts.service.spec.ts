import { Test } from "@nestjs/testing";
import { EscrowsContractsService } from "./escrows-contracts.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EscrowContract } from "./escrow-contract.entity";
import { ContractExecution } from "./contract-execution.entity";
import { ArkService } from "../../ark/ark.service";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ArkAddress, VirtualCoin } from "@arkade-os/sdk";
import { ContractFunded } from "../../common/contract-address.event";
import { nanoid } from "nanoid";

const ARBITRATOR_PUB_KEY = "mock_arbitrator_pubkey";
const newId = () => nanoid(16);

describe("EscrowsContractsService", () => {
	const receiverPubkey = "pubkey-receiver";
	const senderPubkey = "pubkey-sender";
	const initiatorArkAddress =
		"tark1qpt0syx7j0jspe69kldtljet0x9jz6ns4xw70m0w0xl30yfhn0mz6e9gu6zr3epntklwz8h330j8m03u27a4lqnc4dc7z829kxczves5stw760";
	const contractAddress =
		"tark1qra883hysahlkt0ujcwhv0x2n278849c3m7t3a08l7fdc40f4f2nm8925vs39g4edhxnc7mkmed36w2fnydw3evqknfmra58xkmlsx6p3ne7yn";
	const mockVirtualCoins: VirtualCoin[] = [
		// biome-ignore lint/suspicious/noExplicitAny: using only the values we need from VirtualCoin
		{ txid: "tx1", vout: 0, value: 1000 } as any,
	];
	const mockContract = {
		externalId: newId(),
		senderPubkey: senderPubkey,
		receiverPubkey: receiverPubkey,
		status: "funded",
		virtualCoins: mockVirtualCoins,
		request: { externalId: newId() },
	};
	// Mock arkService.createEscrowTransaction
	const mockEscrowTx = {
		arkTx: "mock_ark_tx",
		checkpoints: ["cp1"],
		requiredSigners: ["sender", "receiver", "server"],
	};

	let service: EscrowsContractsService;
	// // biome-ignore lint/suspicious/noExplicitAny: complex mocks
	// let contractRepository: any;
	// // biome-ignore lint/suspicious/noExplicitAny: complex mocks
	// let contractExecutionRepository: any;
	// // biome-ignore lint/suspicious/noExplicitAny: complex mocks
	// let _arkService: any;

	const mockContractRepository = {
		createQueryBuilder: jest.fn(),
		update: jest.fn(),
		findOne: jest.fn(),
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

	mockArkService.createEscrowTransaction.mockResolvedValue(mockEscrowTx);

	// Transaction without signatures!
	const cleanTransaction = {
		...mockEscrowTx,
		vtxo: mockVirtualCoins[0],
	};

	// Mock repository create and save
	const mockExecutionEntity = {
		externalId: newId(),
		contract: { externalId: mockContract.externalId },
		cleanTransaction: {
			...cleanTransaction,
			approvedByPubKeys: [],
			rejectedByPubKeys: [],
		},
		status: "pending-signatures",
		initiatedByPubKey: receiverPubkey,
	};

	// Mock getOneForPartyAndStatus (via createQueryBuilder)
	const qbMock = {
		leftJoinAndSelect: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		getOne: jest.fn().mockResolvedValue(mockContract),
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
		// contractRepository = moduleRef.get(getRepositoryToken(EscrowContract));
		// contractExecutionRepository = moduleRef.get(
		// 	getRepositoryToken(ContractExecution),
		// );
		// _arkService = moduleRef.get(ArkService);

		jest.clearAllMocks();
	});

	describe("createDirectSettlementExecution", () => {
		beforeEach(() => {
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

			const result = await service.createDirectSettlementExecutionWithAddress(
				mockContract.externalId,
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
				status: "pending-signatures",
				cleanTransaction: {
					...cleanTransaction,
					approvedByPubKeys: [],
					rejectedByPubKeys: [],
				},
			});

			// Verify contract status update
			expect(mockContractRepository.update).toHaveBeenCalledWith(
				{ externalId: mockContract.externalId },
				{ status: "pending-execution" },
			);
		});
	});

	describe("onContractFunded", () => {
		const evtContractFunded: ContractFunded = {
			eventId: newId(),
			contractId: mockContract.externalId,
			arkAddress: ArkAddress.decode(contractAddress),
			amountSats: BigInt(mockVirtualCoins[0].value),
			vtxos: mockVirtualCoins,
			detectedAt: new Date().toISOString(),
		};

		beforeEach(() => {
			mockContractRepository.createQueryBuilder.mockReturnValue(qbMock);
			mockContractExecutionRepository.create.mockReturnValue(
				mockExecutionEntity,
			);
			mockContractExecutionRepository.save.mockResolvedValue(
				mockExecutionEntity,
			);
		});

		it("when `receiverAddress` is defined, should create an execution", async () => {
			const contract = {
				...mockContract,
				status: "created",
				receiverAddress: initiatorArkAddress,
				vtxos: undefined,
			};
			mockContractRepository.findOne.mockResolvedValue(contract);
			mockContractRepository.update.mockResolvedValue(contract);
			await service.onContractFunded(evtContractFunded);
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
				initiatedByPubKey: ARBITRATOR_PUB_KEY,
				status: "pending-signatures",
				cleanTransaction: {
					...cleanTransaction,
					approvedByPubKeys: [],
					rejectedByPubKeys: [],
				},
			});
			// Verify contract status update
			expect(mockContractRepository.update).toHaveBeenCalledWith(
				{ externalId: mockContract.externalId },
				{ status: "pending-execution", virtualCoins: evtContractFunded.vtxos },
			);
		});
		it("when `receiverAddress` is not defined, should update the contract status and vtxos", async () => {
			const contract = {
				...mockContract,
				status: "created",
				receiverAddress: undefined,
				vtxos: undefined,
			};
			mockContractRepository.findOne.mockResolvedValue(contract);
			mockContractRepository.update.mockResolvedValue(contract);
			await service.onContractFunded(evtContractFunded);
			expect(mockArkService.createEscrowTransaction).not.toHaveBeenCalled();
			expect(mockContractExecutionRepository.create).not.toHaveBeenCalled();
			// Verify contract status update
			expect(mockContractRepository.update).toHaveBeenCalledWith(
				{ externalId: mockContract.externalId },
				{ status: "funded", virtualCoins: evtContractFunded.vtxos },
			);
		});
	});
});
