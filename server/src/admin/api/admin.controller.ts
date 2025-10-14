import {
	Controller,
	Get,
	Param,
	Patch,
	Query,
	Body,
	ParseIntPipe,
	DefaultValuePipe,
	Sse,
	Post,
} from "@nestjs/common";
import {
	ApiTags,
	ApiQuery,
	ApiParam,
	ApiOperation,
	ApiOkResponse,
	ApiBody,
} from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { ParseCursorPipe } from "../../common/pipes/cursor.pipe";
import {
	ApiPaginatedEnvelope,
	Cursor,
	envelope,
	getSchemaPathForDto,
	getSchemaPathForPaginatedDto,
	paginatedEnvelope,
} from "../../common/dto/envelopes";
import { GetAdminEscrowContractDto } from "./get-admin-escrow-contract.dto";
import { GetAdminEscrowContractDetailsDto } from "./get-admin-escrow-contract-details.dto";
import { interval, map, Observable } from "rxjs";
import {
	ArbitrateDisputeInDto,
	ArbitrateDisputeOutDto,
} from "./arbitrate-dispute-in.dto";

// biome-ignore lint/suspicious/noExplicitAny: just anything remotely JSON-serializable
interface SseEvent<T = any> {
	data: T;
}

@ApiTags("Admin")
@Controller("api/admin/v1")
export class AdminController {
	constructor(private readonly adminService: AdminService) {}

	@ApiOperation({ summary: "List all contracts paginated" })
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
		description: "A page of all contracts",
		schema: getSchemaPathForPaginatedDto(GetAdminEscrowContractDto),
	})
	@Get("contracts")
	async allContracts(
		@Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query("cursor", ParseCursorPipe) cursor: Cursor,
	): Promise<ApiPaginatedEnvelope<GetAdminEscrowContractDto[]>> {
		const { items, nextCursor, total } = await this.adminService.findAll(
			limit,
			cursor,
		);
		return paginatedEnvelope(items, { total, nextCursor });
	}

	@Sse("contracts/sse")
	sse(): Observable<SseEvent> {
		return this.adminService.events.pipe(
			map((event) => ({
				data: event,
			})),
		);
	}

	@ApiOperation({ summary: "Retrieve all details for the given contract" })
	@ApiOkResponse({
		description: "The whole contract",
		schema: getSchemaPathForDto(GetAdminEscrowContractDetailsDto),
	})
	@Get("contracts/:externalId")
	async contractDetails(
		@Param("externalId") externalId: string,
	): Promise<ArbitrateDisputeOutDto> {
		const data = await this.adminService.getContractDetails(externalId);
		return envelope(data);
	}

	@ApiOperation({ summary: "Retrieve all details for the given contract" })
	@ApiBody({ type: ArbitrateDisputeInDto })
	@ApiOkResponse({
		description: "The arbitration result",
		schema: getSchemaPathForDto(GetAdminEscrowContractDetailsDto),
	})
	@Post("contracts/:externalId/arbitrate")
	async arbitrateDispute(
		@Param("externalId") externalId: string,
		@Body() dto: ArbitrateDisputeInDto,
	): Promise<ArbitrateDisputeOutDto> {
		const data = await this.adminService.arbitrateDispute({
			contractId: externalId,
			arbitrationId: dto.disputeId,
			action: dto.action,
		});
		return envelope(data);
	}
}
