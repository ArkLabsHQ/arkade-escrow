import {
	Body,
	Controller,
	DefaultValuePipe,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiExtraModels,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../../auth/auth.guard";
import { UserFromJwt } from "../../auth/user.decorator";
import {
	type ApiEnvelope,
	ApiEnvelopeShellDto,
	ApiPaginatedMetaDto,
	envelope,
	paginatedEnvelope,
	getSchemaPathForDto,
	getSchemaPathForPaginatedDto,
	getSchemaPathForEmptyResponse,
	Cursor,
} from "../../common/dto/envelopes";
import {
	CreateEscrowRequestInDto,
	CreateEscrowRequestOutDto,
} from "./dto/create-escrow-request.dto";
import { EscrowRequestsService } from "./escrow-requests.service";
import { User } from "../../users/user.entity";
import { EscrowsService } from "../escrows.service";
import { OrderbookItemDto } from "./dto/orderbook.dto";
import { GetEscrowRequestDto } from "./dto/get-escrow-request.dto";
import { CreateEscrowContractOutDto } from "../contracts/dto/create-escrow-contract.dto";
import { ParseCursorPipe } from "../../common/pipes/cursor.pipe";

@ApiTags("Escrow Requests")
@ApiExtraModels(
	ApiEnvelopeShellDto,
	ApiPaginatedMetaDto,
	CreateEscrowRequestOutDto,
	OrderbookItemDto,
)
@Controller("api/v1/escrows/requests")
export class EscrowRequestsController {
	constructor(
		private readonly requestsService: EscrowRequestsService,
		private readonly orchestrator: EscrowsService,
	) {}

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
		schema: getSchemaPathForPaginatedDto(OrderbookItemDto),
	})
	@ApiOperation({
		summary: "Public orderbook of escrow requests (only public=true)",
	})
	async orderbook(
		@Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query("cursor", ParseCursorPipe) cursor: Cursor,
	): Promise<ApiEnvelope<OrderbookItemDto[]>> {
		const { items, nextCursor, total } = await this.requestsService.orderbook(
			limit,
			cursor,
		);
		return paginatedEnvelope(items, { total, nextCursor });
	}

	@Post("")
	@ApiBearerAuth()
	@ApiBody({ type: CreateEscrowRequestInDto })
	@ApiCreatedResponse({
		description: "Created successfully",
		schema: getSchemaPathForDto(CreateEscrowRequestOutDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Create an escrow request" })
	async create(
		@Body() dto: CreateEscrowRequestInDto,
		@UserFromJwt() user: User,
	): Promise<ApiEnvelope<CreateEscrowRequestOutDto>> {
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
		schema: getSchemaPathForPaginatedDto(GetEscrowRequestDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Get authenticated user's escrow requests" })
	async getMine(
		@UserFromJwt() user: User,
		@Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query("cursor", ParseCursorPipe) cursor: Cursor,
	): Promise<ApiEnvelope<GetEscrowRequestDto[]>> {
		const { items, nextCursor, total } = await this.requestsService.getByUser(
			user.publicKey,
			limit,
			cursor,
		);
		return paginatedEnvelope(items, { total, nextCursor });
	}

	@Post(":externalId/accept")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Accept a public escrow request and create a contract",
	})
	@ApiParam({ name: "externalId", description: "Public request external id" })
	@ApiCreatedResponse({
		description: "Contract created",
		schema: getSchemaPathForDto(CreateEscrowRequestOutDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({ description: "Not allowed to accept this request" })
	@ApiNotFoundResponse({ description: "Escrow request not found" })
	@ApiConflictResponse({ description: "Request already accepted or canceled" })
	@ApiBadRequestResponse({ description: "Cannot accept private requests" })
	async accept(
		@Param("externalId") externalId: string,
		@UserFromJwt() user: User,
	): Promise<ApiEnvelope<CreateEscrowContractOutDto>> {
		// TODO: move to contracts endpoints
		const acceptorPubkey: string = user.publicKey;
		const c = await this.orchestrator.createContractFromPublicRequest(
			externalId,
			acceptorPubkey,
		);
		const dto: CreateEscrowContractOutDto = {
			externalId: c.externalId,
			requestId: c.request.externalId,
			sender: c.senderPubkey,
			receiver: c.receiverPubkey,
			amount: c.amount,
			arkAddress: c.arkAddress,
			status: "created",
			createdAt: c.createdAt.getTime(),
			updatedAt: c.updatedAt.getTime(),
		};
		return envelope(dto);
	}

	@Get(":externalId")
	@ApiBearerAuth()
	@ApiOkResponse({
		description: "One Escrow request by ID",
		schema: getSchemaPathForDto(GetEscrowRequestDto),
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
	): Promise<ApiEnvelope<GetEscrowRequestDto>> {
		const data = await this.requestsService.getByExternalId(
			externalId,
			user.publicKey,
		);
		return envelope(data);
	}

	@Delete(":externalId")
	@ApiBearerAuth()
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary:
			"Cancel an escrow request, only owner can do this and the request must be open",
	})
	@ApiParam({ name: "externalId", description: "Public request external id" })
	@ApiOkResponse({
		description: "Request cancelled",
		schema: getSchemaPathForEmptyResponse(),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Escrow request not found" })
	@ApiForbiddenResponse({ description: "Not allowed to cancel this request" })
	@ApiConflictResponse({ description: "Request already accepted or canceled" })
	async cancel(
		@Param("externalId") externalId: string,
		@UserFromJwt() user: User,
	): Promise<ApiEnvelope<void>> {
		await this.orchestrator.cancelRequest(externalId, user.publicKey);
		return envelope();
	}
}
