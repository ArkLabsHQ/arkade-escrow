import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { nanoid } from "nanoid";

import { PublicKey } from "../../common/PublicKey";
import { ContractArbitration } from "./contract-arbitration.entity";
import { EscrowContract } from "../contracts/escrow-contract.entity";

@Injectable()
export class ArbitrationService {
	private readonly logger = new Logger(ArbitrationService.name);
	private readonly arbitratorPublicKey: string;

	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(ContractArbitration)
		private readonly arbitrationRepository: Repository<ContractArbitration>,
	) {
		const arbitratorPubKey =
			this.configService.get<string>("ARBITRATOR_PUB_KEY");
		if (!arbitratorPubKey) {
			throw new Error("ARBITRATOR_PUB_KEY is not set");
		}
		this.arbitratorPublicKey = arbitratorPubKey;
	}

	async createDispute(input: {
		contractId: string;
		claimant: PublicKey;
		reason: string;
	}): Promise<ContractArbitration> {
		const entity = this.arbitrationRepository.create({
			externalId: nanoid(16),
			contract: { externalId: input.contractId } as Pick<
				EscrowContract,
				"externalId"
			>,
			claimant: input.claimant,
			reason: input.reason,
			status: "pending",
		});
		return await this.arbitrationRepository.save(entity);
	}

	getByContract(contractId: string): Promise<ContractArbitration[]> {
		return this.arbitrationRepository.find({
			where: { contract: { externalId: contractId } },
		});
	}
}
