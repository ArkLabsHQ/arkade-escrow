import { ApiProperty } from "@nestjs/swagger";
import {
	EXECUTION_STATUS,
	ExecutionStatus,
	ExecutionTransaction,
} from "../contract-execution.entity";

export class GetExecutionByContractDto {
	@ApiProperty({ description: "Unique identifier" })
	externalId!: string;

	@ApiProperty({ description: "Public key of the initiator" })
	initiatedByPubKey!: string;

	@ApiProperty({
		description: "Status of the execution",
		enum: EXECUTION_STATUS,
	})
	status!: ExecutionStatus;

	@ApiProperty({ description: "Reason for rejection by counterparty" })
	rejectionReason?: string;

	@ApiProperty({ description: "Reason for cancellation by initiator" })
	cancelationReason?: string;

	@ApiProperty({ description: "ARK Transaction details" })
	transaction!: ExecutionTransaction;

	@ApiProperty({ description: "Unix epoch in milliseconds" })
	createdAt!: number;

	@ApiProperty({ description: "Unix epoch in milliseconds" })
	updatedAt!: number;
}
