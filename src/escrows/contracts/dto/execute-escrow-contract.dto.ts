import { ApiProperty } from "@nestjs/swagger";

export const ACTION_TYPE = ["direct-settle", "release", "refund"] as const;
export type ContractAction = (typeof ACTION_TYPE)[number];

export class ExecuteEscrowContractInDto {
	@ApiProperty({ type: "string" })
	arkAddress!: string;
}

export class ExecuteEscrowContractOutDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({ description: "Contract ID for this execution" })
	contractId!: string;

	@ApiProperty({
		description: "Ark transaction for this execution, to be signed",
	})
	arkTx!: string;

	@ApiProperty({ description: "Checkpoints for this execution, to be signed" })
	checkpoints!: string[];

	@ApiProperty({ description: "VTXO for this execution" })
	vtxo!: {
		txid: string;
		vout: number;
		value: number;
	};
}
