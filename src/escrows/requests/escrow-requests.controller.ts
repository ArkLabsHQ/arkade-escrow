import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiBody,
	ApiExtraModels,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
	getSchemaPath,
} from "@nestjs/swagger";
import { AuthGuard } from "../../auth/auth.guard";
import { UserFromJwt } from "../../auth/user.decorator";
import {
	type ApiEnvelope,
	ApiEnvelopeShellDto,
	ApiPaginatedMetaDto,
	ApiPaginatedEnvelopeShellDto,
	envelope,
	paginatedEnvelope,
} from "../../common/dto/envelopes";
import {
	CreateEscrowRequestDto,
	EscrowRequestCreatedDto,
	EscrowRequestGetDto,
	OrderbookItemDto,
} from "./dto/create-escrow-request.dto";
import { EscrowRequestsService } from "./escrow-requests.service";
import { User } from "../../users/user.entity";
import { EscrowContractDto } from "../contracts/dto/escrow-contract.dto";
import { EscrowsContractsService } from "../contracts/escrows-contracts.service";
import { EscrowsService } from "../escrows.service";

@ApiTags("Escrow Requests")
@ApiExtraModels(
	ApiEnvelopeShellDto,
	ApiPaginatedMetaDto,
	EscrowRequestCreatedDto,
	EscrowRequestGetDto,
	OrderbookItemDto,
)
@Controller("api/v1/escrows/requests")
export class EscrowRequestsController {
	constructor(
		private readonly requestsService: EscrowRequestsService,
		private readonly orchestrator: EscrowsService,
	) {}

	@Post("")
	@ApiBearerAuth()
	@ApiBody({ type: CreateEscrowRequestDto })
	@ApiOkResponse({
		description: "Created successfully",
		schema: {
			allOf: [
				{ $ref: getSchemaPath(ApiEnvelopeShellDto) },
				{
					type: "object",
					properties: {
						data: { $ref: getSchemaPath(EscrowRequestCreatedDto) },
					},
					required: ["data"],
				},
			],
		},
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Create an escrow request" })
	async create(
		@Body() dto: CreateEscrowRequestDto,
		@UserFromJwt() user: User,
	): Promise<ApiEnvelope<EscrowRequestCreatedDto>> {
		const data = await this.requestsService.create(dto, user.publicKey);
		return envelope(data);
	}

	@Get("mine")
	@ApiBearerAuth()
	@ApiQuery({
		name: "limit",
		required: false,
		description: "Max items to return (1–100)",
		schema: { type: "integer", minimum: 1, maximum: 100, example: 20 },
	})
	@ApiQuery({
		name: "cursor",
		required: false,
		description: "Opaque cursor from previous page",
		schema: { type: "string", example: "MTczMjc5NDQ2NTAwMDoxMjM0NQ==" },
	})
	@ApiOkResponse({
		description: "A page of user's requests",
		schema: {
			allOf: [
				{ $ref: getSchemaPath(ApiPaginatedEnvelopeShellDto) },
				{
					type: "object",
					properties: {
						data: {
							type: "array",
							items: { $ref: getSchemaPath(EscrowRequestGetDto) },
						},
						meta: { $ref: getSchemaPath(ApiPaginatedMetaDto) },
					},
					required: ["data", "meta"],
				},
			],
		},
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Get authenticated user's escrow requests" })
	async getMine(
		@UserFromJwt() user: User,
		@Query("limit") limit?: string,
		@Query("cursor") cursor?: string,
	): Promise<ApiEnvelope<EscrowRequestGetDto[]>> {
		const n = limit ? parseInt(limit, 10) : undefined;
		const { items, nextCursor, total } = await this.requestsService.getByUser(
			user.publicKey,
			n,
			cursor,
		);
		return paginatedEnvelope(items, { total, nextCursor });
	}

	@Get(":externalId")
	@ApiBearerAuth()
	@ApiOkResponse({
		description: "Escrow request",
		schema: {
			allOf: [
				{ $ref: getSchemaPath(ApiEnvelopeShellDto) },
				{
					type: "object",
					properties: {
						data: { $ref: getSchemaPath(EscrowRequestGetDto) },
					},
					required: ["data"],
				},
			],
		},
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({ description: "Not allowed to view this request" })
	@ApiNotFoundResponse({ description: "Escrow request not found" })
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary:
			"Get a single escrow request by externalId (requires auth unless public and owned by caller)",
	})
	async getOne(
		@Param("externalId") externalId: string,
		@UserFromJwt() user: User,
	): Promise<ApiEnvelope<EscrowRequestGetDto>> {
		const data = await this.requestsService.getByExternalId(
			externalId,
			user.publicKey,
		);
		return envelope(data);
	}

	@Post(":externalId/accept")
	@UseGuards(AuthGuard)
	@ApiBearerAuth("access-jwt")
	@ApiOperation({
		summary: "Accept a public escrow request and create a contract",
	})
	@ApiParam({ name: "externalId", description: "Public request external id" })
	@ApiOkResponse({ description: "Contract created", type: EscrowContractDto })
	async accept(
		@Param("externalId") externalId: string,
		@Req() req: any,
	): Promise<ApiEnvelope<EscrowContractDto>> {
		const acceptorPubkey: string = req.user.pubkey;
		const { escrowContract: c } =
			await this.orchestrator.createContractFromPublicRequest(
				externalId,
				acceptorPubkey,
			);
		const dto: EscrowContractDto = {
			id: c.id,
			externalId: c.externalId,
			sender: c.senderPubkey,
			receiver: c.receiverPubkey,
			amount: c.amount,
			arkAddress: c.arkAddress,
			createdAt: c.createdAt.toISOString(),
			updatedAt: c.updatedAt.toISOString(),
		};
		return { data: dto };
	}

	@Get("orderbook")
	@ApiQuery({
		name: "limit",
		required: false,
		description: "Max items to return (1–100)",
		schema: { type: "integer", minimum: 1, maximum: 100, example: 20 },
	})
	@ApiQuery({
		name: "cursor",
		required: false,
		description: "Opaque cursor from previous page",
		schema: { type: "string", example: "MTczMjc5NDQ2NTAwMDoxMjM0NQ==" },
	})
	@ApiOkResponse({
		description: "A page of public requests",
		schema: {
			allOf: [
				{ $ref: getSchemaPath(ApiPaginatedEnvelopeShellDto) },
				{
					type: "object",
					properties: {
						data: {
							type: "array",
							items: { $ref: getSchemaPath(OrderbookItemDto) },
						},
						meta: { $ref: getSchemaPath(ApiPaginatedMetaDto) },
					},
					required: ["data", "meta"],
				},
			],
		},
	})
	@ApiOperation({
		summary: "Public orderbook of escrow requests (only public=true)",
	})
	async orderbook(
		@Query("limit") limit?: string,
		@Query("cursor") cursor?: string,
	): Promise<ApiEnvelope<OrderbookItemDto[]>> {
		const n = limit ? parseInt(limit, 10) : undefined;
		const { items, nextCursor, total } = await this.requestsService.orderbook(
			n,
			cursor,
		);
		return paginatedEnvelope(items, { total, nextCursor });
	}
}
