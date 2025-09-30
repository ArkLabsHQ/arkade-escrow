import { Param } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

export class SignExecutionInDto {
	@ApiProperty({ description: "Ark transaction as PSBT encoded as HEX string" })
	arkTx!: string;

	@ApiProperty({ description: "Checpoints as PSBT encoded as HEX strings" })
	checkpoints!: string[];
}
