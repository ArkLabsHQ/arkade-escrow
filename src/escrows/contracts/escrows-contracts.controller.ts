import {
	Controller,
	DefaultValuePipe,
	Get,
	ParseIntPipe,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { EscrowsContractsService } from "./escrows-contracts.service";
import {
	type ApiEnvelope,
	getSchemaPathForPaginatedDto,
	paginatedEnvelope,
	cursorFromString,
	Cursor,
} from "../../common/dto/envelopes";
import { AuthGuard } from "../../auth/auth.guard";
import { UserFromJwt } from "../../auth/user.decorator";
import { User } from "../../users/user.entity";
import { EscrowContract } from "./escrow-contract.entity";
import { GetEscrowContractDto } from "./dto/get-escrow-contract.dto";
import { ParseCursorPipe } from "../../common/pipes/cursor.pipe";

@ApiTags("Escrow Contracts")
@Controller()
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
		schema: { type: "string", example: "MTczMjc5NDQ2NTAwMDoxMjM0NQ==" },
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
}
