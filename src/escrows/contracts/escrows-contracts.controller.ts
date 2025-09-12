import { Controller, Post, Param, Req, UseGuards } from "@nestjs/common";
import {
	ApiOperation,
	ApiOkResponse,
	ApiTags,
	ApiParam,
	ApiBearerAuth,
} from "@nestjs/swagger";
import { EscrowsContractsService } from "./escrows-contracts.service";
import { EscrowContractDto } from "./dto/escrow-contract.dto";
import { ApiEnvelope } from "../../common/dto/envelopes";
import { AuthGuard } from "../../auth/auth.guard";

@ApiTags("Escrows")
@Controller()
export class EscrowsContractsController {
	constructor(private readonly svc: EscrowsContractsService) {}

	@Post("/escrows/requests/:externalId/accept")
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
		const c = await this.svc.acceptRequest(externalId, acceptorPubkey);
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
}
