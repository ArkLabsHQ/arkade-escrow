import { Test } from "@nestjs/testing";
import { EscrowsContractsService } from "./escrows-contracts.service";
import { ArkService } from "../../ark/ark.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ObjectLiteral, Repository } from "typeorm";
import arkCfg from "../../config/ark.config";
import {
	ConflictException,
	ForbiddenException,
	BadRequestException,
	NotFoundException,
} from "@nestjs/common";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { EscrowContract } from "./escrow-contract.entity";

type MockRepo<T extends ObjectLiteral> = Partial<
	Record<keyof Repository<T>, jest.Mock>
> & {
	data?: any[];
};

function createRepoMock<T extends ObjectLiteral>(): MockRepo<T> {
	return {
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn((x) => x),
		manager: {
			transaction: (fn: any) =>
				fn({ getRepository: () => ({ save: (x: any) => Promise.resolve(x) }) }),
		} as any,
	} as any;
}

describe("EscrowsService", () => {
	let service: EscrowsContractsService;
	let reqRepo: MockRepo<EscrowRequest>;
	let cRepo: MockRepo<EscrowContract>;
	let ark: ArkService;

	beforeEach(async () => {
		reqRepo = createRepoMock<EscrowRequest>();
		cRepo = createRepoMock<EscrowContract>();

		const moduleRef = await Test.createTestingModule({
			providers: [
				EscrowsContractsService,
				ArkService,
				{ provide: getRepositoryToken(EscrowRequest), useValue: reqRepo },
				{ provide: getRepositoryToken(EscrowContract), useValue: cRepo },
				{
					provide: arkCfg.KEY,
					useValue: { arbitratorXOnly: "ARBITRATOR", network: "signet" },
				},
			],
		}).compile();

		service = moduleRef.get(EscrowsContractsService);
		ark = moduleRef.get(ArkService);
		jest
			.spyOn(ark, "deriveEscrowAddress")
			.mockResolvedValue("ark1-signet-sender-receiver-arb");
	});

	const BASE_REQ: EscrowRequest = {
		id: 1,
		externalId: "REQ123",
		creatorPubkey: "CREATOR",
		side: "receiver",
		amount: 1000,
		description: "desc",
		public: true,
		status: "open",
		acceptedByPubkey: null as any,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	test("role mapping: side=receiver -> creator=receiver, acceptor=sender", async () => {
		reqRepo.findOne!.mockResolvedValue({ ...BASE_REQ, side: "receiver" });
		const saved = await service.acceptRequest("REQ123", "ACCEPTOR");
		expect(ark.deriveEscrowAddress).toHaveBeenCalledWith(
			expect.objectContaining({
				senderXOnly: "ACCEPTOR",
				receiverXOnly: "CREATOR",
			}),
		);
		expect(saved.senderPubkey).toBe("ACCEPTOR");
		expect(saved.receiverPubkey).toBe("CREATOR");
	});

	test("role mapping: side=sender -> creator=sender, acceptor=receiver", async () => {
		reqRepo.findOne!.mockResolvedValue({ ...BASE_REQ, side: "sender" });
		const saved = await service.acceptRequest("REQ123", "ACCEPTOR");
		expect(ark.deriveEscrowAddress).toHaveBeenCalledWith(
			expect.objectContaining({
				senderXOnly: "CREATOR",
				receiverXOnly: "ACCEPTOR",
			}),
		);
		expect(saved.senderPubkey).toBe("CREATOR");
		expect(saved.receiverPubkey).toBe("ACCEPTOR");
	});

	test("guard: cannot accept own request", async () => {
		reqRepo.findOne!.mockResolvedValue(BASE_REQ);
		await expect(
			service.acceptRequest("REQ123", "CREATOR"),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	test("guard: only public", async () => {
		reqRepo.findOne!.mockResolvedValue({ ...BASE_REQ, public: false });
		await expect(service.acceptRequest("REQ123", "X")).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});

	test("guard: must be open", async () => {
		reqRepo.findOne!.mockResolvedValue({ ...BASE_REQ, status: "accepted" });
		await expect(service.acceptRequest("REQ123", "X")).rejects.toBeInstanceOf(
			ConflictException,
		);
	});

	test("not found", async () => {
		reqRepo.findOne!.mockResolvedValue(null);
		await expect(service.acceptRequest("REQ404", "X")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	test("Ark seam used and address embedded", async () => {
		reqRepo.findOne!.mockResolvedValue(BASE_REQ);
		const saved = await service.acceptRequest("REQ123", "ACCEPTOR");
		expect(saved.arkAddress).toBe("ark1-signet-sender-receiver-arb");
	});
});
