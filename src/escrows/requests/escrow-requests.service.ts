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
	CreateEscrowRequestDto,
	EscrowRequestCreatedDto,
	EscrowRequestGetDto,
	OrderbookItemDto,
} from "./dto/create-escrow-request.dto";
import { ConfigService } from "@nestjs/config";

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
		dto: CreateEscrowRequestDto,
		pubKey: string,
	): Promise<EscrowRequestCreatedDto> {
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
	): Promise<EscrowRequestGetDto> {
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
		limit = 20,
		cursor?: string,
	): Promise<{
		items: EscrowRequestGetDto[];
		nextCursor?: string;
		total: number;
	}> {
		let createdBefore: number | undefined;
		let idBefore: number | undefined;

		if (cursor) {
			try {
				const raw = Buffer.from(cursor, "base64").toString("utf8");
				// cursor format: `${createdAtMs}:${id}`
				const [tsStr, idStr] = raw.split(":");
				const ts = Number(tsStr);
				const idNum = Number(idStr);
				if (Number.isFinite(ts)) createdBefore = ts;
				if (Number.isFinite(idNum)) idBefore = idNum;
			} catch (e: unknown) {
				this.logger.error("Malformed cursor", e);
			}
		}

		const take = Math.min(Math.max(limit ?? 1, 1), 100);

		const qb = this.repo
			.createQueryBuilder("r")
			.where("r.creatorPubkey = :pubKey", { pubKey });

		if (createdBefore !== undefined && idBefore !== undefined) {
			qb.andWhere(
				new Brackets((w) => {
					w.where("r.createdAt < :createdBefore", {
						createdBefore: new Date(createdBefore),
					}).orWhere(
						new Brackets((w2) => {
							w2.where("r.createdAt = :createdAtEq", {
								createdAtEq: new Date(createdBefore),
							}).andWhere("r.id < :idBefore", { idBefore });
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
			nextCursor = EscrowRequestsService.makeCursor(last.createdAt, last.id);
		}

		const items: EscrowRequestGetDto[] = rows.map((r) => ({
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

	async writeAccepted(
		request: EscrowRequest,
		manager?: EntityManager,
	): Promise<EscrowRequest> {
		if (!request.acceptedByPubkey) {
			throw new ConflictException(
				"Cannot accept a request without an acceptor",
			);
		}
		const repo = this.repoFor(manager);
		return await repo.save({
			...request,
			status: "accepted",
		});
	}

	async orderbook(
		limit = 20,
		cursor?: string,
	): Promise<{
		items: OrderbookItemDto[];
		nextCursor?: string;
		total: number;
	}> {
		let createdBefore: number | undefined;
		let idBefore: number | undefined;

		if (cursor) {
			try {
				const raw = Buffer.from(cursor, "base64").toString("utf8");
				// cursor format: `${createdAtMs}:${id}`
				const [tsStr, idStr] = raw.split(":");
				const ts = Number(tsStr);
				const idNum = Number(idStr);
				if (Number.isFinite(ts)) createdBefore = ts;
				if (Number.isFinite(idNum)) idBefore = idNum;
			} catch (e: unknown) {
				this.logger.error("Malformed cursor", e);
			}
		}

		const take = Math.min(Math.max(limit ?? 1, 1), 100);

		const qb = this.repo
			.createQueryBuilder("r")
			.where("r.public = :pub", { pub: true });

		if (createdBefore !== undefined && idBefore !== undefined) {
			qb.andWhere(
				new Brackets((w) => {
					w.where("r.createdAt < :createdBefore", {
						createdBefore: new Date(createdBefore),
					}).orWhere(
						new Brackets((w2) => {
							w2.where("r.createdAt = :createdAtEq", {
								createdAtEq: new Date(createdBefore),
							}).andWhere("r.id < :idBefore", { idBefore });
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
			nextCursor = EscrowRequestsService.makeCursor(last.createdAt, last.id);
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

	static makeCursor(createdAt: Date, id: number): string {
		return Buffer.from(`${createdAt.getTime()}:${id}`, "utf8").toString(
			"base64",
		);
	}
}
