import { ApiProperty } from "@nestjs/swagger";

export class ExecuteArbitrationResultInDto {
	@ApiProperty({
		type: "string",
		description: "Ark address to send the funds to",
	})
	arkAddress!: string;
}
