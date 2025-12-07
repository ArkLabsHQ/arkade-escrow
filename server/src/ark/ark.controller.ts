import {
	ApiExtraModels,
	ApiInternalServerErrorResponse,
	ApiOkResponse,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { Controller, Get, InternalServerErrorException } from "@nestjs/common";
import { ArkService } from "./ark.service";
import { GetArkInfoOutDto } from "./dto/get-arkInfo-request.dto";
import {
	ApiEnvelopeShellDto,
	envelope,
	getSchemaPathForDto,
} from "../common/dto/envelopes";
import { ConfigService } from "@nestjs/config";

@ApiTags("ark")
@ApiExtraModels(GetArkInfoOutDto)
@Controller("api/v1/ark")
export class ArkController {
	constructor(
		private readonly arkService: ArkService,
		private readonly configService: ConfigService,
	) {}

	@Get("info")
	@ApiOperation({ summary: "Get Ark info" })
	@ApiOkResponse({
		description: "Ark info",
		schema: getSchemaPathForDto(GetArkInfoOutDto),
	})
	@ApiInternalServerErrorResponse({ description: "Ark info not available" })
	getInfo(): ApiEnvelopeShellDto<GetArkInfoOutDto> {
		const arkInfo = this.arkService.getInfo();
		if (!arkInfo)
			throw new InternalServerErrorException("Ark info not available");
		const escrowServerPublicKey =
			this.configService.get<string>("ARBITRATOR_PUB_KEY");
		if (!escrowServerPublicKey) {
			throw new InternalServerErrorException("ARBITRATOR_PUB_KEY is not set");
		}
		return envelope({
			escrowServerPublicKey,
			arkServerUrl: arkInfo.arkServerUrl,
			network: arkInfo.network,
			dust: arkInfo.dust.toString(10),
		});
	}
}
