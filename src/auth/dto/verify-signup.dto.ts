import { IsString, Matches, Length } from "class-validator";
const HEX = /^[0-9a-f]+$/i;

export class VerifySignupDto {
	@IsString()
	@Matches(HEX)
	@Length(64, 66)
	publicKey!: string;

	@IsString()
	@Matches(HEX)
	@Length(128, 128, { message: "signature must be 64 bytes (128 hex chars)" })
	signature!: string;

	@IsString()
	challengeId!: string;
}
