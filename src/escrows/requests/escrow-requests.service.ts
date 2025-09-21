import {
	ConflictException,
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { type Repository, Brackets, EntityManager } from "typeorm";
import { customAlphabet } from "nanoid";
import { EscrowRequest } from "./escrow-request.entity";
import type {
	CreateEscrowRequestInDto,
	CreateEscrowRequestOutDto,
} from "./dto/create-escrow-request.dto";
import { ConfigService } from "@nestjs/config";
import { OrderbookItemDto } from "./dto/orderbook.dto";
import { GetEscrowRequestDto } from "./dto/get-escrow-request.dto";
import {
	Cursor,
	emptyCursor,
	cursorFromString,
	cursorToString,
} from "../../common/dto/envelopes";

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
	) {
		// SHARE_BASE_URL like: https://app.example/escrows/requests
		this.shareBase =
			this.config.get<string>("SHARE_BASE_URL") ??
			"http://localhost:3000/escrows/requests";
	}

	private repoFor(manager?: EntityManager) {
		return manager ? manager.getRepository(EscrowRequest) : this.repo;
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

		return {
			externalId: found.externalId,
			side: found.side as "receiver" | "sender",
			amount: found.amount ?? undefined,
			description: found.description,
			status: found.status,
			public: found.public,
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

		const qb = this.repo
			.createQueryBuilder("r")
			.where("r.creatorPubkey = :pubKey", { pubKey });

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
			where: { creatorPubkey: pubKey },
		});

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}

		const items: GetEscrowRequestDto[] = rows.map((r) => ({
			externalId: r.externalId,
			side: r.side as "receiver" | "sender",
			amount: r.amount ?? undefined,
			description: r.description,
			status: r.status,
			public: r.public,
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

		const qb = this.repo
			.createQueryBuilder("r")
			.where("r.public = :pub", { pub: true });

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
			where: { public: true },
		});

		let nextCursor: string | undefined;
		if (rows.length === take) {
			const last = rows[rows.length - 1];
			nextCursor = cursorToString(last.createdAt, last.id);
		}

		const items: OrderbookItemDto[] = rows.map((r) => ({
			externalId: r.externalId,
			side: r.side,
			creatorPublicKey: r.creatorPubkey,
			amount: r.amount ?? undefined,
			description: r.description,
			status: r.status,
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
