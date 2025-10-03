import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsArray } from "class-validator";

export class SignExecutionInDto {
	@ApiProperty({ description: "Ark transaction as PSBT encoded as HEX string" })
	@IsString()
	arkTx!: string;

	@ApiProperty({ description: "Checpoints as PSBT encoded as HEX strings" })
	@IsArray()
	@IsString({ each: true })
	checkpoints!: string[];
}
