import { IsString, Matches, Length } from "class-validator";
const HEX = /^[0-9a-f]+$/i;

export class RequestChallengeDto {
	@IsString()
	@Matches(HEX, { message: "publicKey must be hex" })
	@Length(64, 66, {
		message: "publicKey must be 64 (x-only) or 66 (compressed) hex chars",
	})
	publicKey!: string;
}
