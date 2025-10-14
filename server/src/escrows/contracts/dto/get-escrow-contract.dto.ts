import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";
import { CONTRACT_STATUS, ContractStatus } from "../escrow-contract.entity";
import { VirtualCoin } from "@arkade-os/sdk";

export class GetEscrowContractDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	requestId!: string;

	@ApiProperty({ description: "Sender public key" })
	senderPublicKey!: string;

	@ApiProperty({ description: "Receiver public key" })
	receiverPublicKey!: string;

	@ApiProperty({
		minimum: 0,
		description: "Amount in satoshis or your smallest unit",
	})
	@IsNumber()
	@Min(0)
	amount!: number;

	@ApiProperty({ description: "ARK address of the contract", nullable: true })
	arkAddress?: string;

	@ApiProperty({
		enum: CONTRACT_STATUS,
		description: "Contract status",
		default: "created",
	})
	status!: ContractStatus;

	@ApiProperty()
	description!: string;

	@ApiProperty({ enum: ["receiver", "sender"] })
	side!: "receiver" | "sender";

	@ApiProperty({ description: "Cancellation reason, if any", nullable: true })
	cancelationReason?: string;

	@ApiProperty({
		description: "Unspent VTXO for this contract",
	})
	virtualCoins?: VirtualCoin[];

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
