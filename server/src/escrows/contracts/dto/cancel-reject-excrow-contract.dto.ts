import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CancelRejectExcrowContractDto {
	@ApiProperty({
		description: "Reason for rejection or cancellation",
		example: "Insufficient funds",
	})
	@IsString()
	reason!: string;
}
