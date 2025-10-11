import { ApiProperty } from "@nestjs/swagger";
import { ArbitrationStatus } from "../../arbitration/contract-arbitration.entity";

export class DisputeEscrowContractInDto {
	@ApiProperty({ description: "Reason for dispute", required: true })
	reason!: string;
}

export class DisputeEscrowContractOutDto {
	@ApiProperty({
		example: "q3f7p9n4z81k6c0b",
		description: "The Arbitration ID",
	})
	externalId!: string;

	@ApiProperty({ example: "q3f7p9n4z81k6c0b", description: "The Contract ID" })
	contractId!: string;

	@ApiProperty({
		description: "Public Key of the claimant who initiated the dispute",
	})
	claimant!: string;

	@ApiProperty({
		description: "Reason for dispute",
	})
	reason!: string;

	@ApiProperty({
		description: "Status of the dispute",
	})
	status!: ArbitrationStatus;

	@ApiProperty({ description: "Unix epoch in milliseconds" })
	createdAt!: number;

	@ApiProperty({ description: "Unix epoch in milliseconds" })
	updatedAt!: number;
}
