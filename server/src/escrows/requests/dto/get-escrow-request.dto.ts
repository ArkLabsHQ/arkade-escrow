import { ApiProperty } from "@nestjs/swagger";
import { REQUEST_STATUS, RequestStatus } from "../escrow-request.entity";
import { IsNumber, Min } from "class-validator";

export class GetEscrowRequestDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({ enum: ["receiver", "sender"] })
	side!: "receiver" | "sender";

	@ApiProperty({ description: "Owner public key" })
	creatorPublicKey!: string;

	@ApiProperty({
		minimum: 0,
		description: "Amount in satoshis or your smallest unit",
	})
	@IsNumber()
	@Min(0)
	amount?: number;

	@ApiProperty()
	description!: string;

	@ApiProperty()
	shareUrl!: string;

	@ApiProperty({
		enum: REQUEST_STATUS,
		description: "Request status",
	})
	status!: RequestStatus;

	@ApiProperty()
	public!: boolean;

	@ApiProperty({
		description: "Number of contracts for this request",
		default: 0,
	})
	contractsCount!: number;

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	createdAt!: number;
}
