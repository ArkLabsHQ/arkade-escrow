import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { REQUEST_STATUS, RequestStatus } from "../escrow-request.entity";

export class GetEscrowRequestDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({ enum: ["receiver", "sender"] })
	side!: "receiver" | "sender";

	@ApiPropertyOptional()
	amount?: number;

	@ApiProperty()
	description!: string;

	@ApiProperty({
		enum: REQUEST_STATUS,
		description: "Request status",
	})
	status!: RequestStatus;

	@ApiProperty()
	public!: boolean;

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	createdAt!: number;
}
