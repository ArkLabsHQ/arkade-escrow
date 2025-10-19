import {
	ApiBearerAuth,
	ApiBody,
	ApiCreatedResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
	Body,
	Controller,
	DefaultValuePipe,
	Get,
	NotFoundException,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../auth/auth.guard";
import {
	ApiEnvelope,
	ApiPaginatedEnvelope,
	Cursor,
	envelope,
	getSchemaPathForDto,
	getSchemaPathForPaginatedDto,
	paginatedEnvelope,
} from "../../common/dto/envelopes";
import { DisputeEscrowContractInDto } from "../contracts/dto/dispute-escrow-contract.dto";
import { UserFromJwt } from "../../auth/user.decorator";
import { ArbitrationService } from "./arbitration.service";
import { User } from "../../users/user.entity";
import { GetArbitrationDto } from "./dto/get-arbitration.dto";
import { ExecuteArbitrationResultInDto } from "../contracts/dto/execute-arbitration-result.dto";
import { ParseCursorPipe } from "../../common/pipes/cursor.pipe";
import { ExecuteEscrowContractOutDto } from "../contracts/dto/execute-escrow-contract.dto";

@ApiTags("3 - Arbitrations")
@Controller("api/v1/escrows/arbitrations")
export class ArbitrationController {
	constructor(private readonly service: ArbitrationService) {}

	@Post("")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Dispute a contract" })
	@ApiBody({ type: DisputeEscrowContractInDto })
	@ApiCreatedResponse({
		description: "The created arbitration",
		schema: getSchemaPathForDto(GetArbitrationDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Escrow contract not found" })
	async disputeContract(
		@UserFromJwt() user: User,
		@Body() dto: DisputeEscrowContractInDto,
	): Promise<ApiEnvelope<GetArbitrationDto>> {
		const pendingDispute = await this.service.createArbitration({
			contractId: dto.contractId,
			claimantPublicKey: user.publicKey,
			reason: dto.reason,
		});
		return envelope(pendingDispute);
	}

	@Get("")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve all contract arbitrations for the user" })
	@ApiOkResponse({
		description: "Arbitration where the user is involved",
		schema: getSchemaPathForPaginatedDto(GetArbitrationDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
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
	async getMine(
		@UserFromJwt() user: User,
		@Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query("cursor", ParseCursorPipe) cursor: Cursor,
	): Promise<ApiPaginatedEnvelope<GetArbitrationDto[]>> {
		const { items, total, nextCursor } = await this.service.getByUser(
			user.publicKey,
			limit,
			cursor,
		);
		return paginatedEnvelope(items, { total, nextCursor });
	}

	@Get(":arbitrationId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Retrieve contract dispute by ID" })
	@ApiParam({
		name: "arbitrationId",
		description: "Contract external id",
	})
	@ApiOkResponse({
		description: "Contract dispute arbitration",
		schema: getSchemaPathForDto(GetArbitrationDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Dispute not found" })
	async getOneById(
		@UserFromJwt() user: User,
		@Param("contractId") contractId: string,
	): Promise<ApiEnvelope<GetArbitrationDto>> {
		// TODO: dedicated query
		const arbitration = await this.service.getOneByExternalId(contractId, user);
		if (!arbitration) throw new NotFoundException("Arbitration not found");
		return envelope(arbitration);
	}

	@Patch(":arbitrationId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary:
			"Update arbitration with ARK address for final transaction, returns a partially signed transaction",
	})
	@ApiBody({ type: ExecuteArbitrationResultInDto })
	@ApiParam({
		name: "arbitrationId",
		description: "Arbitration external id",
	})
	@ApiOkResponse({
		description: "Transaction execution to be signed",
		schema: getSchemaPathForDto(ExecuteEscrowContractOutDto),
	})
	@ApiUnauthorizedResponse({ description: "Missing/invalid JWT" })
	@ApiNotFoundResponse({ description: "Dispute not found" })
	async executeArbitrationResult(
		@UserFromJwt() user: User,
		@Body() dto: ExecuteArbitrationResultInDto,
		@Param("disputeId") arbitrationId: string,
	): Promise<ApiEnvelope<ExecuteEscrowContractOutDto>> {
		const result = await this.service.createArbitrationExecution(
			{
				externalId: arbitrationId,
				arkAddress: dto.arkAddress,
			},
			user,
		);
		return envelope(result);
	}
}
