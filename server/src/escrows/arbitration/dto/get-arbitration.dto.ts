import {
	ArbitrationStatus,
	VERDICT,
	Verdict,
} from "../contract-arbitration.entity";
import { ApiProperty } from "@nestjs/swagger";

export class GetArbitrationDto {
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
	claimantPublicKey!: string;

	@ApiProperty({
		description: "Public Key of the defendant",
	})
	defendantPublicKey!: string;

	@ApiProperty({
		description: "Reason for dispute",
	})
	reason!: string;

	@ApiProperty({
		description: "Status of the dispute",
	})
	status!: ArbitrationStatus;

	@ApiProperty({
		description: "Verdict of the dispute",
		enum: VERDICT,
		nullable: true,
	})
	verdict?: Verdict;

	@ApiProperty({ description: "Unix epoch in milliseconds" })
	createdAt!: number;

	@ApiProperty({ description: "Unix epoch in milliseconds" })
	updatedAt!: number;
}
