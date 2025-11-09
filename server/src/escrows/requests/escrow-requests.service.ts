import {
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { type Repository, Brackets } from "typeorm";
import { customAlphabet } from "nanoid";
import { ConfigService } from "@nestjs/config";

import { EscrowRequest } from "./escrow-request.entity";
import type {
	CreateEscrowRequestInDto,
	CreateEscrowRequestOutDto,
} from "./dto/create-escrow-request.dto";
import { OrderbookItemDto } from "./dto/orderbook.dto";
import { GetEscrowRequestDto } from "./dto/get-escrow-request.dto";
import {
	Cursor,
	emptyCursor,
	cursorToString,
} from "../../common/dto/envelopes";
import {
	CONTRACT_EXECUTED_ID,
	ContractExecuted,
} from "../../common/contract-address.event";
import { randomUUID } from "node:crypto";
import { ArkAddress } from "@arkade-os/sdk";
import { REQUEST_CREATED_ID, RequestCreated } from "../../common/request.event";
import { EventEmitter2 } from "@nestjs/event-emitter";

// TODO: from configuration?
const generateNanoid = customAlphabet(
	"0123456789abcdefghijklmnopqrstuvwxyz",
	16,
);

@Injectable()
export class EscrowRequestsService {
	private readonly shareBase: string;
	private readonly logger = new Logger(EscrowRequestsService.name);

	constructor(
		@InjectRepository(EscrowRequest)
		private readonly repo: Repository<EscrowRequest>,
		private readonly config: ConfigService,
		private readonly events: EventEmitter2,
	) {
		// SHARE_BASE_URL like: https://app.example/escrows/requests
		this.shareBase =
			this.config.get<string>("SHARE_BASE_URL") ??
			"http://localhost:3000/escrows/requests";
	}

	async create(
		dto: CreateEscrowRequestInDto,
		pubKey: string,
	): Promise<CreateEscrowRequestOutDto> {
		const externalId = generateNanoid();
		try {
			const entity = this.repo.create({
				externalId,
				side: dto.side,
				creatorPubkey: pubKey,
				amount: dto.amount ?? null,
				description: dto.description,
				public: dto.public ?? false,
			});
			await this.repo.save(entity);
			this.events.emit(REQUEST_CREATED_ID, {
				eventId: randomUUID(),
				requestId: entity.externalId,
				creatorPubkey: entity.creatorPubkey,
				createdAt: new Date().toISOString(),
			} satisfies RequestCreated);
			return {
				externalId,
				shareUrl: `${this.shareBase}/${externalId}`,
			};
		} catch (e) {
			this.logger.error("Failed to create escrow request", e);
			throw new InternalServerErrorException("Failed to create escrow request");
		}
	}

	async getByExternalId(
		externalId: string,
		pubKey: string,
	): Promise<GetEscrowRequestDto> {
		const found = await this.findOneByExternalId(externalId);
		if (!found) throw new NotFoundException("Escrow request not found");

		const isOwner = found.creatorPubkey === pubKey;
		if (!found.public && !isOwner) {
			throw new ForbiddenException("Not allowed to view this request");
		}

		const contractsCount = await this.repo
			.createQueryBuilder()
			.select("COUNT(*)", "contractsCount")
			.from("escrow_contracts", "c")
			.where("c.requestExternalId = :externalId", { externalId }) // TODO only my pkey
			.execute();

		return {
			externalId: found.externalId,
			side: found.side as "receiver" | "sender",
			creatorPublicKey: found.creatorPubkey,
			amount: found.amount ?? undefined,
			description: found.description,
			status: found.status,
			public: found.public,
			contractsCount,
			createdAt: found.createdAt.getTime(),
		};
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
		items: GetEscrowRequestDto[];
		nextCursor?: string;
		total: number;
	}> {
		const take = Math.min(limit, 100);

		const rowsQb = this.repo
			.createQueryBuilder("r")
			.where("r.creatorPubkey = :pubKey", { pubKey });

		if (cursor.createdBefore !== undefined && cursor.idBefore !== undefined) {
			rowsQb.andWhere(
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

		const { entities: rows, raw } = await rowsQb
			.orderBy("r.createdAt", "DESC")
			.addOrderBy("r.id", "DESC")
			.take(take)
			.addSelect(
				(sub) =>
					sub
						.select("COUNT(*)", "contractsCount")
						.from("escrow_contracts", "c")
						.where(
							"(c.requestExternalId = r.externalId) AND (c.senderPubkey = :pubKey OR c.receiverPubkey = :pubKey)",
						)
						.setParameters({ pubKey }),
				"contractsCount",
			)
			.getRawAndEntities();

		const total = await this.repo.count({
			where: { creatorPubkey: pubKey },
		});

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}

		const items: GetEscrowRequestDto[] = rows.map((r, i) => ({
			externalId: r.externalId,
			side: r.side as "receiver" | "sender",
			creatorPublicKey: r.creatorPubkey,
			amount: r.amount ?? undefined,
			description: r.description,
			status: r.status,
			public: r.public,
			contractsCount: Number(raw[i]?.contractsCount ?? 0),
			createdAt: r.createdAt.getTime(),
		}));

		return { items, nextCursor, total };
	}

	async orderbook(
		limit: number,
		cursor: Cursor = emptyCursor,
	): Promise<{
		items: OrderbookItemDto[];
		nextCursor?: string;
		total: number;
	}> {
		const take = Math.min(limit, 100);

		const rowsQb = this.repo
			.createQueryBuilder("r")
			.where("r.public = :pub", { pub: true });

		if (cursor.createdBefore !== undefined && cursor.idBefore !== undefined) {
			rowsQb.andWhere(
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

		const { entities: rows, raw } = await rowsQb
			.orderBy("r.createdAt", "DESC")
			.addOrderBy("r.id", "DESC")
			.take(take)
			.addSelect(
				(sub) =>
					sub
						.select("COUNT(*)", "contractsCount")
						.from("escrow_contracts", "c")
						.where("c.requestExternalId = r.externalId"),
				"contractsCount",
			)
			.getRawAndEntities();

		console.log(raw);

		const total = await this.repo.count({
			where: { public: true },
		});

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}

		const items: OrderbookItemDto[] = rows.map((r, i) => ({
			externalId: r.externalId,
			side: r.side,
			creatorPublicKey: r.creatorPubkey,
			amount: r.amount ?? 0,
			description: r.description,
			status: r.status,
			public: r.public,
			contractsCount: Number(raw[i]?.contractsCount ?? 0),
			createdAt: r.createdAt.getTime(),
		}));

		return { items, nextCursor, total };
	}

	async findOneByExternalId(externalId: string): Promise<EscrowRequest | null> {
		return this.repo.findOne({
			where: { externalId },
		});
	}

	async cancel(externalId: string) {
		this.repo.update({ externalId }, { status: "cancelled" });
	}
}
