import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";

import { EscrowsContractsService } from "./contracts/escrows-contracts.service";
import { EscrowRequestsService } from "./requests/escrow-requests.service";
import { ConfigService } from "@nestjs/config";
import { ArkService } from "../ark/ark.service";
import { DataSource, EntityManager } from "typeorm";

/**
 * Orchestrator service for escrow requests and contracts.
 */
@Injectable()
export class EscrowsService {
	private readonly logger = new Logger(EscrowsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService,
		private readonly ark: ArkService,
		private readonly requestsService: EscrowRequestsService,
		private readonly contractsService: EscrowsContractsService,
	) {}

	async createContractFromPublicRequest(
		requestExternalId: string,
		acceptorPubkey: string,
	) {
		const request =
			await this.requestsService.findOneByExternalId(requestExternalId);
		if (!request) throw new NotFoundException("Escrow request not found");
		if (!request.public)
			throw new BadRequestException(
				"Only public requests can be accepted right now",
			);
		if (request.status !== "open")
			throw new ConflictException(`Request is ${request.status}`);
		if (request.creatorPubkey === acceptorPubkey)
			throw new ForbiddenException("Cannot accept your own request");

		const creatorIsReceiver = request.side === "receiver";
		const senderPubkey = creatorIsReceiver
			? acceptorPubkey
			: request.creatorPubkey;
		const receiverPubkey = creatorIsReceiver
			? request.creatorPubkey
			: acceptorPubkey;

		return this.dataSource.transaction(
			"READ COMMITTED",
			async (manager: EntityManager) => {
				const escrowContract =
					await this.contractsService.createContractForRequest(
						{
							requestExternalId: request.externalId,
							senderPubKey: senderPubkey,
							receiverPubKey: receiverPubkey,
							amount: request.amount ?? 0,
						},
						manager,
					);
				const escrowRequest = await this.requestsService.writeAccepted({
					...request,
					acceptedByPubkey: acceptorPubkey,
				});
				return { escrowContract, escrowRequest };
			},
		);
	}
}
