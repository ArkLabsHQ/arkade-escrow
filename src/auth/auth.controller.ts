import {
	Body,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	Post,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiExtraModels,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { RequestChallengeDto } from "./dto/request-challenge.dto";
import { VerifySignupDto } from "./dto/verify-signup.dto";
import { ConfigService } from "@nestjs/config";

@ApiTags("Authentication")
@ApiExtraModels(RequestChallengeDto, VerifySignupDto)
@Controller("api/v1/auth")
export class AuthController {
	constructor(
		private readonly configService: ConfigService,
		private readonly auth: AuthService,
	) {}

	@Post("signup/challenge")
	@ApiBody({ type: RequestChallengeDto })
	@ApiOkResponse({
		schema: {
			type: "object",
			properties: {
				challenge: { type: "object" },
				challengeId: { type: "string" },
				hashToSignHex: { type: "string" },
				expiresAt: { type: "string", format: "date-time" },
			},
		},
	})
	@ApiOperation({
		summary: "Start signup by requesting a challenge for a given public key",
	})
	async challenge(
		@Body() dto: RequestChallengeDto,
		@Headers("origin") origin?: string,
	) {
		const effectiveOrigin =
			origin ??
			// biome-ignore lint/style/noNonNullAssertion: has default value
			this.configService.get("AUTH_CHALLENGE_ORIGIN", "https://api.local")!;
		return this.auth.createSignupChallenge(dto.publicKey, effectiveOrigin);
	}

	@Post("signup/verify")
	@ApiBody({ type: VerifySignupDto })
	@ApiOkResponse({
		schema: {
			type: "object",
			properties: {
				accessToken: { type: "string" },
				userId: { type: "string" },
				publicKey: { type: "string" },
			},
		},
	})
	@ApiBadRequestResponse()
	@ApiUnauthorizedResponse()
	@ApiOperation({ summary: "Verify the signed challenge and receive a JWT" })
	async verify(
		@Body() dto: VerifySignupDto,
		@Headers("origin") origin?: string,
	) {
		const effectiveOrigin =
			origin ??
			// biome-ignore lint/style/noNonNullAssertion: has default value
			this.configService.get("AUTH_CHALLENGE_ORIGIN", "https://api.local")!;
		return this.auth.verifySignup(
			dto.publicKey,
			dto.signature,
			dto.challengeId,
			effectiveOrigin,
		);
	}

	@Post("/signout")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "WIP - Sign out of the application" })
	async signout() {
		// TODO: void JWT
		// return { data: {} };
		throw new InternalServerErrorException("Not implemented");
	}
}
