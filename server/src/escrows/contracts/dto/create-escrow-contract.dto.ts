import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString, Min } from "class-validator";
import { CONTRACT_STATUS, ContractStatus } from "../escrow-contract.entity";

export class CreateEscrowContractInDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b", description: "The Request ID" })
	@IsString()
	@IsNotEmpty()
	requestId!: string;
}

export class CreateEscrowContractOutDto {
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
		enum: CONTRACT_STATUS,
		description: "Contract status",
		default: "created",
	})
	status: ContractStatus = "created";

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	updatedAt!: number;
}

export class DraftEscrowContractOutDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	requestId!: string;

	@ApiProperty({ description: "Sender public key" })
	senderPublicKey!: string;

	@ApiProperty({ description: "Sender ARK address", nullable: true })
	senderAddress?: string;

	@ApiProperty({ description: "Receiver public key" })
	receiverPublicKey!: string;

	@ApiProperty({ description: "Receiver ARK address", nullable: true })
	receiverAddress?: string;

	@ApiProperty({
		description: "Amount in satoshis or your smallest unit",
	})
	amount!: number;

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	createdAt!: number;

	@ApiProperty({
		enum: CONTRACT_STATUS,
		description: "Contract status",
		default: "draft",
	})
	status: ContractStatus = "draft";

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	updatedAt!: number;
}
