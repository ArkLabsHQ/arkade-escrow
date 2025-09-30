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

export class CreateEscrowRequestInDto {
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

export class CreateEscrowRequestOutDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({
		example: "https://app.example/escrows/requests/q3f7p9n4z81k6c0b",
	})
	shareUrl!: string;
}
