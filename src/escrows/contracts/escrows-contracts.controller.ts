import {
	Body,
	Controller,
	DefaultValuePipe,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiBody,
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
import { EscrowContract } from "./escrow-contract.entity";
import { GetEscrowContractDto } from "./dto/get-escrow-contract.dto";
import { ParseCursorPipe } from "../../common/pipes/cursor.pipe";
import {
	ExecuteEscrowContractOutDto,
	ExecuteEscrowContractInDto,
} from "./dto/execute-escrow-contract.dto";
import { GetExecutionsByContractDto } from "./dto/get-executions-by-contract";

@ApiTags("Escrow Contracts")
@Controller("api/v1/escrows/contracts")
export class EscrowsContractsController {
	constructor(private readonly service: EscrowsContractsService) {}

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
	): Promise<ApiEnvelope<GetEscrowContractDto[]>> {
		const { items, nextCursor, total } = await this.service.getByUser(
			user.publicKey,
			limit,
			cursor,
		);
		return paginatedEnvelope(items, { total, nextCursor });
	}

	@Post(":externaId/execute")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create an execution transations for the contract" })
	@ApiParam({ name: "externalId", description: "Contract external id" })
	@ApiBody({ type: ExecuteEscrowContractInDto })
	@ApiOkResponse({
		description: "Execution transations initiated",
		schema: getSchemaPathForDto(ExecuteEscrowContractOutDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({ description: "Not allowed to modify this contract" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async initiateSpendingPath(
		@Body() dto: ExecuteEscrowContractInDto,
		@UserFromJwt() user: User,
		@Param("externalId") externalId: string,
	): Promise<ApiEnvelope<ExecuteEscrowContractOutDto>> {
		const ce = await this.service.createContractExecution(
			externalId,
			dto.action,
			user.publicKey,
		);
		return envelope(ce);
	}

	@Get(":externalId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve a contract by externalId" })
	@ApiParam({ name: "externalId", description: "Contract external id" })
	@ApiOkResponse({
		description: "Execution transaction initiated",
		schema: getSchemaPathForDto(GetEscrowContractDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({ description: "Not allowed to access this contract" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async getOne(
		@UserFromJwt() user: User,
		@Param("externalId") externalId: string,
	): Promise<ApiEnvelope<GetEscrowContractDto>> {
		const contract = await this.service.getOneByExternalId(
			externalId,
			user.publicKey,
		);
		return envelope(contract);
	}

	@Get(":externalId/executions")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve all contract executions by contract" })
	@ApiParam({ name: "externalId", description: "Contract external id" })
	@ApiOkResponse({
		description: "Execution transations initiated",
		schema: getSchemaPathForPaginatedDto(GetExecutionsByContractDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiForbiddenResponse({ description: "Not allowed to access this contract" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async getExecutionsForContract(
		@UserFromJwt() user: User,
		@Param("externalId") externalId: string,
	): Promise<ApiPaginatedEnvelope<GetExecutionsByContractDto[]>> {
		const executions = await this.service.getAllExecutionsByContractId(
			externalId,
			user.publicKey,
		);
		return paginatedEnvelope(executions, { total: executions.length });
	}
}
