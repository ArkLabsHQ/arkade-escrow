import {
	Body,
	Controller,
	Delete,
	Get,
	Logger,
	Param,
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
	getSchemaPathForDto,
	getSchemaPathForPaginatedDto,
	getSchemaPathForEmptyResponse,
} from "../../common/dto/envelopes";
import {
	CreateEscrowRequestDto,
	EscrowRequestCreatedDto,
	EscrowRequestGetDto,
	OrderbookItemDto,
} from "./dto/create-escrow-request.dto";
import { EscrowRequestsService } from "./escrow-requests.service";
import { User } from "../../users/user.entity";
import { EscrowContractCreatedDto } from "../contracts/dto/escrow-contract.dto";
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
	private readonly logger = new Logger(EscrowRequestsController.name);

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

	@Post("")
	@ApiBearerAuth()
	@ApiBody({ type: CreateEscrowRequestDto })
	@ApiCreatedResponse({
		description: "Created successfully",
		schema: getSchemaPathForDto(EscrowRequestCreatedDto),
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
		schema: getSchemaPathForPaginatedDto(EscrowRequestGetDto),
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

	@Post(":externalId/accept")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Accept a public escrow request and create a contract",
	})
	@ApiParam({ name: "externalId", description: "Public request external id" })
	@ApiCreatedResponse({
		description: "Contract created",
		schema: getSchemaPathForDto(EscrowContractCreatedDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({ description: "Not allowed to accept this request" })
	@ApiNotFoundResponse({ description: "Escrow request not found" })
	@ApiConflictResponse({ description: "Request already accepted or canceled" })
	@ApiBadRequestResponse({ description: "Cannot accept private requests" })
	async accept(
		@Param("externalId") externalId: string,
		@UserFromJwt() user: User,
	): Promise<ApiEnvelope<EscrowContractCreatedDto>> {
		const acceptorPubkey: string = user.publicKey;
		const { escrowContract: c } =
			await this.orchestrator.createContractFromPublicRequest(
				externalId,
				acceptorPubkey,
			);
		const dto: EscrowContractCreatedDto = {
			externalId: c.externalId,
			requestId: c.request.externalId,
			sender: c.senderPubkey,
			receiver: c.receiverPubkey,
			amount: c.amount,
			arkAddress: c.arkAddress,
			createdAt: c.createdAt.getTime(),
			updatedAt: c.updatedAt.getTime(),
		};
		return envelope(dto);
	}

	@Get(":externalId")
	@ApiBearerAuth()
	@ApiOkResponse({
		description: "One Escrow request by ID",
		schema: getSchemaPathForDto(EscrowRequestGetDto),
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
