import {
	Injectable,
	BadRequestException,
	ForbiddenException,
	ConflictException,
	NotFoundException,
	Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { nanoid } from "nanoid";
import { ArkService } from "../../ark/ark.service";
import arkCfg from "../../config/ark.config";
import { ConfigService, ConfigType } from "@nestjs/config";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { EscrowContract } from "./escrow-contract.entity";

@Injectable()
export class EscrowsContractsService {
	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(EscrowRequest)
		private readonly reqRepo: Repository<EscrowRequest>,
		@InjectRepository(EscrowContract)
		private readonly cRepo: Repository<EscrowContract>,
		private readonly ark: ArkService,
	) {}

	async acceptRequest(
		externalId: string,
		acceptorPubkey: string,
	): Promise<EscrowContract> {
		const req = await this.reqRepo.findOne({ where: { externalId } });
		if (!req) throw new NotFoundException("Request not found");
		if (!req.public)
			throw new BadRequestException(
				"Only public requests can be accepted right now",
			);
		if (req.status !== "open")
			throw new ConflictException(`Request is ${req.status}`);
		if (req.creatorPubkey === acceptorPubkey)
			throw new ForbiddenException("Cannot accept your own request");

		const creatorIsReceiver = req.side === "receiver";
		const senderPubkey = creatorIsReceiver ? acceptorPubkey : req.creatorPubkey;
		const receiverPubkey = creatorIsReceiver
			? req.creatorPubkey
			: acceptorPubkey;

		const arkAddress = await this.ark.deriveEscrowAddress({
			senderXOnly: senderPubkey,
			receiverXOnly: receiverPubkey,
			// biome-ignore lint/style/noNonNullAssertion: default value
			arbitratorXOnly: this.configService.get(
				"ARBITRATOR_XONLY_PUBKEY",
				"NOT_SET",
			)!,
			network: this.configService.get("ARK_NETWORK", "testnet"),
		});

		const contract = this.cRepo.create({
			externalId: nanoid(16),
			request: req,
			senderPubkey,
			receiverPubkey,
			amount: req.amount ?? 0,
			arkAddress,
		});

		return await this.reqRepo.manager.transaction(async (tx) => {
			req.status = "accepted";
			req.acceptedByPubkey = acceptorPubkey;
			await tx.getRepository(EscrowRequest).save(req);
			const saved = await tx.getRepository(EscrowContract).save(contract);
			return saved;
		});
	}
}
