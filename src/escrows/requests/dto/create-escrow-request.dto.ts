import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsBoolean,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
} from "class-validator";

export class CreateEscrowRequestDto {
	@ApiProperty({
		enum: ["receiver", "sender"],
		description: "The receiver or sender of the funds",
	})
	@IsEnum(["receiver", "sender"])
	side!: "receiver" | "sender";

	@ApiProperty({
		minimum: 0,
		description: "Amount in satoshis or your smallest unit",
	})
	@IsNumber()
	@Min(0)
	amount!: number;

	@ApiProperty({ maxLength: 1000 })
	@IsString()
	@MaxLength(1000)
	description!: string;

	@ApiPropertyOptional({
		description: "Whether the request is visible on the public orderbook",
	})
	@IsOptional()
	@IsBoolean()
	public?: boolean;
}

export class EscrowRequestCreatedDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({
		example: "https://app.example/escrows/requests/q3f7p9n4z81k6c0b",
	})
	shareUrl!: string;
}

export class EscrowRequestGetDto {
	@ApiProperty({ enum: ["receiver", "sender"] })
	side!: "receiver" | "sender";

	@ApiPropertyOptional()
	amount?: number;

	@ApiProperty()
	description!: string;

	@ApiProperty()
	public!: boolean;

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	createdAt!: number;
}

export class OrderbookItemDto {
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

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	createdAt!: number;
}
