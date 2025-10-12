import { ApiProperty } from "@nestjs/swagger";

const ARBITRATOR_ACTION_TYPE = ["settle", "refund"] as const;
type ArbitratorActionType = (typeof ARBITRATOR_ACTION_TYPE)[number];

export class ArbitrateDisputeInDto {
	@ApiProperty({ description: "The dispute ID" })
	disputeId!: string;

	@ApiProperty({ enum: ARBITRATOR_ACTION_TYPE })
	action!: ArbitratorActionType;
}

export class ArbitrateDisputeOutDto {}
