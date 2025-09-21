import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

export const ACTION_TYPE = ["direct-settle", "release", "refund"] as const;
export type ContractAction = (typeof ACTION_TYPE)[number];

export class ExecuteEscrowContractInDto {
	@ApiProperty({
		enum: ACTION_TYPE,
		description: "The spending path to use",
	})
	@IsEnum(ACTION_TYPE, {
		message: `action must be one of: ${ACTION_TYPE.join(", ")}`,
	})
	action!: ContractAction;
}

export class ExecuteEscrowContractOutDto {
	@ApiProperty({ example: "q3f7p9n4z81k6c0b" })
	externalId!: string;

	@ApiProperty({ description: "Contract ID for this execution" })
	contractId!: string;

	@ApiProperty({
		description: "Ark transaction for this execution, to be signed",
	})
	arkTx!: number[];

	@ApiProperty({ description: "Checkpoints for this execution, to be signed" })
	checkpoints!: number[][];

	@ApiProperty({ description: "VTXO for this execution" })
	vtxo!: {
		txid: string;
		vout: number;
		value: number;
	};
}
