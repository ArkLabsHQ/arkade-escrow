import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";

export class EscrowContractCreatedDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	requestId!: string;

	@ApiProperty({ description: "Sender public key" })
	sender!: string;

	@ApiProperty({ description: "Receiver public key" })
	receiver!: string;

	@ApiProperty({
		minimum: 0,
		description: "Amount in satoshis or your smallest unit",
	})
	@IsNumber()
	@Min(0)
	amount!: number;

	@ApiProperty({ description: "ARK address of the contract" })
	arkAddress!: string;

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	createdAt!: number;

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	updatedAt!: number;
}
