import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Brackets, EntityManager, Repository } from "typeorm";
import { nanoid } from "nanoid";

import { ArkService } from "../../ark/ark.service";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { EscrowContract } from "./escrow-contract.entity";
import { ContractAddressCreatedEvent } from "../../common/ContractAddress";
import { randomUUID } from "node:crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { GetEscrowContractDto } from "./dto/get-escrow-contract.dto";
import {
	Cursor,
	cursorToString,
	emptyCursor,
} from "../../common/dto/envelopes";

@Injectable()
export class EscrowsContractsService {
	private readonly logger = new Logger(EscrowsContractsService.name);

	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(EscrowContract)
		private readonly repo: Repository<EscrowContract>,
		private readonly arkService: ArkService,
		private readonly events: EventEmitter2,
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
			arkAddress: arkAddress.encode(),
		});
		this.events.emit("contracts.address.created", {
			eventId: randomUUID(),
			contractId: entity.externalId,
			arkAddress,
			createdAt: new Date().toISOString(),
		} satisfies ContractAddressCreatedEvent);
		return await repo.save(entity);
	}

	async cancelContract(contractId: string): Promise<void> {
		// TODO: mark cancelled and look up arkAddress, cannot cancel if funded?
		// this.events.emit("contracts.address.voided", {
		// 	eventId: randomUUID(),
		// 	contractId,
		// 	arkAddress,
		// 	reason: "cancelled_by_user",
		// 	voidedAt: new Date().toISOString(),
		// } satisfies ContractAddressVoidedEvent);
	}

	/*
	 * Cursor is base64(`${createdAtMs}:${id}`).
	 * Returns the current page and the nextCursor (if more items exist), plus total public items.
	 */
	async getByUser(
		pubKey: string,
		limit: number,
		cursor: Cursor = emptyCursor,
	): Promise<{
		items: GetEscrowContractDto[];
		nextCursor?: string;
		total: number;
	}> {
		const take = Math.min(limit, 100);

		const qb = this.repo.createQueryBuilder("r").where(
			new Brackets((w) => {
				w.where("r.senderPubkey = :pubKey", { pubKey }).orWhere(
					"r.receiverPubkey = :pubKey",
					{ pubKey },
				);
			}),
		);

		if (cursor.createdBefore !== undefined && cursor.idBefore !== undefined) {
			qb.andWhere(
				new Brackets((w) => {
					w.where("r.createdAt < :createdBefore", {
						createdBefore: cursor.createdBefore,
					}).orWhere(
						new Brackets((w2) => {
							w2.where("r.createdAt = :createdAtEq", {
								createdAtEq: cursor.createdBefore,
							}).andWhere("r.id < :idBefore", { idBefore: cursor.idBefore });
						}),
					);
				}),
			);
		}

		const rows = await qb
			.orderBy("r.createdAt", "DESC")
			.addOrderBy("r.id", "DESC")
			.take(take)
			.getMany();

		const total = await this.repo.count({
			where: [{ senderPubkey: pubKey }, { receiverPubkey: pubKey }],
		});

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}

		const items: GetEscrowContractDto[] = rows.map((r) => ({
			externalId: r.externalId,
			requestId: r.request.externalId,
			sender: r.senderPubkey,
			receiver: r.receiverPubkey,
			amount: r.amount,
			arkAddress: r.arkAddress,
			status: r.status,
			balance: r.balance ?? BigInt(0),
			createdAt: r.createdAt.getTime(),
			updatedAt: r.updatedAt.getTime(),
		}));

		return { items, nextCursor, total };
	}

	async findByRequestId(requestExternalId: string) {
		return await this.repo.findOne({
			where: {
				request: { externalId: requestExternalId },
			},
		});
	}
}
