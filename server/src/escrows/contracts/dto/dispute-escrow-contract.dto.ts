import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class DisputeEscrowContractInDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b", description: "The Contract ID" })
	@IsString()
	@IsNotEmpty()
	contractId!: string;

	@ApiProperty({ description: "Reason for dispute", required: true })
	@IsString()
	@IsNotEmpty()
	reason!: string;
}
