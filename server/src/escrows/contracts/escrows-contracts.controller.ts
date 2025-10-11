import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	DefaultValuePipe,
	ForbiddenException,
	Get,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseIntPipe,
	Patch,
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
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { EscrowsContractsService } from "./escrows-contracts.service";
import {
	type ApiEnvelope,
	getSchemaPathForPaginatedDto,
	paginatedEnvelope,
	Cursor,
	getSchemaPathForDto,
	envelope,
	ApiPaginatedEnvelope,
} from "../../common/dto/envelopes";
import { AuthGuard } from "../../auth/auth.guard";
import { UserFromJwt } from "../../auth/user.decorator";
import { User } from "../../users/user.entity";
import {
	CONTRACT_STATUS,
	ContractStatus,
	EscrowContract,
} from "./escrow-contract.entity";
import { GetEscrowContractDto } from "./dto/get-escrow-contract.dto";
import { ParseCursorPipe } from "../../common/pipes/cursor.pipe";
import {
	ExecuteEscrowContractOutDto,
	ExecuteEscrowContractInDto,
} from "./dto/execute-escrow-contract.dto";
import { EscrowRequestsService } from "../requests/escrow-requests.service";
import {
	CreateEscrowContractInDto,
	DraftEscrowContractOutDto,
} from "./dto/create-escrow-contract.dto";
import { SignExecutionInDto } from "./dto/sign-execution.dto";
import { GetExecutionByContractDto } from "./dto/get-execution-by-contract";
import {
	DisputeEscrowContractInDto,
	DisputeEscrowContractOutDto,
} from "./dto/dispute-escrow-contract.dto";

@ApiTags("Escrow Contracts")
@Controller("api/v1/escrows/contracts")
export class EscrowsContractsController {
	private readonly logger = new Logger(EscrowsContractsController.name);

	constructor(
		private readonly service: EscrowsContractsService,
		private readonly requestsService: EscrowRequestsService,
	) {}

	@Get("")
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
		schema: { type: "string" },
	})
	@ApiQuery({
		name: "status",
		required: false,
		description: "Filter by status",
		schema: {
			type: "string",
			enum: CONTRACT_STATUS.slice(0),
		},
	})
	@ApiOkResponse({
		description: "A page of user's contracts",
		schema: getSchemaPathForPaginatedDto(EscrowContract),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Get authenticated user's escrow contracts" })
	async getMine(
		@UserFromJwt() user: User,
		@Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query("cursor", ParseCursorPipe) cursor: Cursor,
		@Query("status") status?: ContractStatus,
	): Promise<ApiEnvelope<GetEscrowContractDto[]>> {
		const { items, nextCursor, total } = await this.service.getByUser(
			user.publicKey,
			{ status },
			limit,
			cursor,
		);
		return paginatedEnvelope(items, { total, nextCursor });
	}

	@Post("")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Create a contract from a public Escrow request",
	})
	@ApiBody({ type: CreateEscrowContractInDto })
	@ApiCreatedResponse({
		description: "Contract created",
		schema: getSchemaPathForDto(DraftEscrowContractOutDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({
		description: "Not allowed to create a contract from this request",
	})
	@ApiNotFoundResponse({ description: "Escrow request not found" })
	@ApiConflictResponse({ description: "Request canceled" })
	async create(
		@Body() dto: CreateEscrowContractInDto,
		@UserFromJwt() user: User,
	): Promise<ApiEnvelope<DraftEscrowContractOutDto>> {
		this.logger.log("Accepting contract from request", dto.requestId);
		const request = await this.requestsService.findOneByExternalId(
			dto.requestId,
		);
		if (!request) throw new NotFoundException("Escrow request not found");
		if (!request.public)
			throw new BadRequestException(
				"Only public requests can be accepted right now",
			);
		if (request.status !== "open")
			throw new ConflictException(`Request is ${request.status}`);
		if (request.creatorPubkey === user.publicKey)
			throw new ForbiddenException("Cannot accept your own request.");
		if ((request.amount ?? 0) <= 0) {
			throw new BadRequestException("Cannot accept a request with 0 amount");
		}

		switch (request.side) {
			case "sender": {
				const contract = await this.service.createDraftContract({
					initiator: "receiver",
					senderPubkey: request.creatorPubkey,
					receiverPubkey: user.publicKey,
					amount: request.amount ?? 0,
					requestId: request.externalId,
				});
				return envelope(contract);
			}
			case "receiver": {
				const contract = await this.service.createDraftContract({
					initiator: "sender",
					senderPubkey: user.publicKey,
					receiverPubkey: request.creatorPubkey,
					amount: request.amount ?? 0,
					requestId: request.externalId,
				});
				return envelope(contract);
			}
			default:
				throw new ConflictException(`Invalid request side ${request.side}`);
		}
	}

	@Post(":contractId/execute")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary:
			"Create a direct settlement execution transaction for the contract",
	})
	@ApiParam({ name: "contractId", description: "Contract external id" })
	@ApiBody({ type: ExecuteEscrowContractInDto })
	@ApiOkResponse({
		description: "Execution transations initiated",
		schema: getSchemaPathForDto(ExecuteEscrowContractOutDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({
		description: "Not allowed to execute direct settlement for this contract",
	})
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async initiateSpendingPath(
		@Body() dto: ExecuteEscrowContractInDto,
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
	): Promise<ApiEnvelope<ExecuteEscrowContractOutDto>> {
		const ce = await this.service.createDirectSettlementExecution(
			contractId,
			dto.arkAddress,
			user.publicKey,
		);
		return envelope(ce);
	}

	@Get(":contractId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve a contract by externalId" })
	@ApiParam({ name: "contractId", description: "Contract external id" })
	@ApiOkResponse({
		description: "Execution transaction initiated",
		schema: getSchemaPathForDto(GetEscrowContractDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({ description: "Not allowed to access this contract" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async getOne(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
	): Promise<ApiEnvelope<GetEscrowContractDto>> {
		const contract = await this.service.getOneByExternalId(
			contractId,
			user.publicKey,
		);
		return envelope(contract);
	}

	@Post(":contractId/accept")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Enter a draft contract by externalId" })
	@ApiParam({ name: "contractId", description: "Contract external id" })
	@ApiOkResponse({
		description: "Contract accepted",
		schema: getSchemaPathForDto(GetEscrowContractDto),
	})
	@HttpCode(200)
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async enterContract(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
	): Promise<ApiEnvelope<GetEscrowContractDto>> {
		const contract = await this.service.acceptDraftContract(
			contractId,
			user.publicKey,
		);
		return envelope(contract);
	}

	@Post(":contractId/reject")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Reject a draft contract by externalId" })
	@ApiParam({ name: "contractId", description: "Contract external id" })
	@ApiBody({
		type: "object",
		schema: {
			properties: {
				reason: { type: "string" },
			},
			required: ["reason"],
		},
	})
	@ApiOkResponse({
		description: "Contract rejected",
		schema: getSchemaPathForDto(GetEscrowContractDto),
	})
	@HttpCode(200)
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async rejectContract(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
		@Body() dto: { reason: string },
	): Promise<ApiEnvelope<GetEscrowContractDto>> {
		const contract = await this.service.rejectDraftContract({
			externalId: contractId,
			rejectorPubkey: user.publicKey,
			reason: dto.reason,
		});
		return envelope(contract);
	}

	@Post(":contractId/dispute")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Open a dispute for a contract by externalId" })
	@ApiParam({ name: "contractId", description: "Contract external id" })
	@ApiBody({ type: DisputeEscrowContractInDto })
	@ApiCreatedResponse({
		description: "The created dispute",
		schema: getSchemaPathForDto(DisputeEscrowContractOutDto),
	})
	@HttpCode(200)
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async disputeContract(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
		@Body() dto: { reason: string },
	): Promise<ApiEnvelope<DisputeEscrowContractOutDto>> {
		const pendingDispute = await this.service.disputeContract({
			externalId: contractId,
			claimant: user.publicKey,
			reason: dto.reason,
		});
		return envelope(pendingDispute);
	}

	@Get(":contractId/disputes")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve all contract disputes by contract" })
	@ApiParam({ name: "contractId", description: "Contract external id" })
	@ApiOkResponse({
		description: "Disputes initiated",
		schema: getSchemaPathForPaginatedDto(DisputeEscrowContractOutDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async getDisputesForContract(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
	): Promise<ApiPaginatedEnvelope<DisputeEscrowContractOutDto[]>> {
		const disputes = await this.service.getAllDisputesByContractId(
			contractId,
			user.publicKey,
		);
		return paginatedEnvelope(disputes, { total: disputes.length });
	}

	@Get(":contractId/disputes/:disputeId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve contract dispute by ID" })
	@ApiParam({
		name: "contractId",
		description: "Contract external id",
	})
	@ApiParam({
		name: "disputeId",
		description: "Dispute external id",
	})
	@ApiOkResponse({
		description: "Contract dispute",
		schema: getSchemaPathForDto(DisputeEscrowContractOutDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Dispute not found" })
	async getDisputeById(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
		@Param("disputeId") executionId: string,
	): Promise<ApiEnvelope<DisputeEscrowContractOutDto>> {
		// TODO: dedicated query
		const disputes = await this.service.getAllDisputesByContractId(
			contractId,
			user.publicKey,
		);
		const result = disputes.find((e) => e.externalId === executionId);
		if (!result) throw new NotFoundException("Dispute not found");
		return envelope(result);
	}

	@Get(":contractId/executions")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve all contract executions by contract" })
	@ApiParam({ name: "contractId", description: "Contract external id" })
	@ApiOkResponse({
		description: "Execution transations initiated",
		schema: getSchemaPathForPaginatedDto(GetExecutionByContractDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async getExecutionsForContract(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
	): Promise<ApiPaginatedEnvelope<GetExecutionByContractDto[]>> {
		const executions = await this.service.getAllExecutionsByContractId(
			contractId,
			user.publicKey,
		);
		return paginatedEnvelope(executions, { total: executions.length });
	}

	@Get(":contractId/executions/:executionId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve contract execution by ID" })
	@ApiParam({
		name: "contractId",
		description: "Contract external id",
	})
	@ApiParam({
		name: "executionId",
		description: "Contract execution external id",
	})
	@ApiOkResponse({
		description: "Contract execution",
		schema: getSchemaPathForDto(GetExecutionByContractDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Escrow execution not found" })
	async getExecutionById(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
		@Param("executionId") executionId: string,
	): Promise<ApiEnvelope<GetExecutionByContractDto>> {
		// TODO: dedicated query
		const executions = await this.service.getAllExecutionsByContractId(
			contractId,
			user.publicKey,
		);
		const result = executions.find((e) => e.externalId === executionId);
		if (!result) throw new NotFoundException("Escrow execution not found");
		return envelope(result);
	}
}
