import { IsString, Matches, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
const HEX = /^[0-9a-f]+$/i;

export class RequestChallengeDto {
	@ApiProperty({ type: "string", description: "Public key" })
	@IsString()
	@Matches(HEX, { message: "publicKey must be hex" })
	@Length(64, 66, {
		message: "publicKey must be 64 (x-only) or 66 (compressed) hex chars",
	})
	publicKey!: string;
}
