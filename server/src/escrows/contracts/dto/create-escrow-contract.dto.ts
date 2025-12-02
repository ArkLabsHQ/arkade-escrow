import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { CONTRACT_STATUS, ContractStatus } from "../escrow-contract.entity";

export class CreateEscrowContractInDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b", description: "The Request ID" })
	@IsString()
	@IsNotEmpty()
	requestId!: string;

	@ApiProperty({
		example:
			"ark1qpt0syx7j0jspe69kldtljet0x9jz6ns4xw70m0w0xl30yfhn0mz6e9gu6zr3epntklwz8h330j8m03u27a4lqnc4dc7z829kxczves5stw760",
		description: "Ark Address of the receiver, optional",
	})
	@IsString()
	@IsOptional()
	receiverAddress?: string;
}

export class DraftEscrowContractOutDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	requestId!: string;

	@ApiProperty({ description: "Sender public key" })
	senderPublicKey!: string;

	@ApiProperty({ description: "Receiver public key" })
	receiverPublicKey!: string;

	@ApiProperty({ description: "Receiver ARK address", nullable: true })
	receiverAddress?: string;

	@ApiProperty({
		description: "Amount in satoshis or your smallest unit",
	})
	amount!: number;

	@ApiProperty({
		enum: CONTRACT_STATUS,
		description: "Contract status",
		default: "draft",
	})
	status: ContractStatus = "draft";

	@ApiProperty()
	description!: string;

	@ApiProperty({ enum: ["receiver", "sender"] })
	side!: "receiver" | "sender";

	@ApiProperty({
		description: "Which side created the contract",
	})
	createdBy!: string;

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	createdAt!: number;

	@ApiProperty({
		description: "Unix epoch in milliseconds",
		example: 1732690234123,
	})
	updatedAt!: number;
}
