import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ExecuteArbitrationResultInDto {
	@IsNotEmpty()
	@IsString()
	@ApiProperty({
		type: "string",
		description: "Ark address to send the funds to",
	})
	arkAddress!: string;
}
