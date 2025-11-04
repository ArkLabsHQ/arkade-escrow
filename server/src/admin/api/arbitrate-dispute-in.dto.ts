import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

const ARBITRATOR_ACTION_TYPE = ["release", "refund"] as const;
type ArbitratorActionType = (typeof ARBITRATOR_ACTION_TYPE)[number];

export class ArbitrateDisputeInDto {
	@ApiProperty({ description: "The dispute ID" })
	@IsString()
	@IsNotEmpty()
	disputeId!: string;

	@ApiProperty({ enum: ARBITRATOR_ACTION_TYPE })
	@IsString()
	@IsNotEmpty()
	action!: ArbitratorActionType;
}

export class ArbitrateDisputeOutDto {}
