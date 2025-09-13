import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { EntityManager, Repository } from "typeorm";
import { nanoid } from "nanoid";

import { ArkService } from "../../ark/ark.service";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { EscrowContract } from "./escrow-contract.entity";

@Injectable()
export class EscrowsContractsService {
	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(EscrowContract)
		private readonly repo: Repository<EscrowContract>,
		private readonly arkService: ArkService,
	) {}

	private repoFor(manager?: EntityManager) {
		return manager ? manager.getRepository(EscrowContract) : this.repo;
	}

	async createContractForRequest(
		input: {
			requestExternalId: string;
			senderPubKey: string;
			receiverPubKey: string;
			amount: number;
		},
		manager?: EntityManager,
	) {
		const arbitratorPubKey = this.configService.get("ARBITRATOR_PUB_KEY");
		if (!arbitratorPubKey) {
			throw new Error("ARBITRATOR_PUB_KEY is not set");
		}
		if (input.senderPubKey === arbitratorPubKey) {
			throw new Error("Cannot create a contract with the arbitrator as sender");
		}
		if (input.receiverPubKey === arbitratorPubKey) {
			throw new Error(
				"Cannot create a contract with the arbitrator as receiver",
			);
		}
		const arkAddress = this.arkService.createArkAddressForContract({
			receiver: {
				pubKey: input.receiverPubKey,
			},
			sender: {
				pubKey: input.senderPubKey,
			},
			arbitrator: {
				pubKey: arbitratorPubKey,
			},
		});
		const repo = this.repoFor(manager);
		const entity = repo.create({
			externalId: nanoid(16),
			request: { externalId: input.requestExternalId } as Pick<
				EscrowRequest,
				"externalId"
			>,
			senderPubkey: input.senderPubKey,
			receiverPubkey: input.receiverPubKey,
			amount: input.amount ?? 0,
			arkAddress,
		});
		return await repo.save(entity);
	}

	async findByRequestId(requestExternalId: string) {
		return await this.repo.findOne({
			where: {
				request: { externalId: requestExternalId },
			},
		});
	}
}
