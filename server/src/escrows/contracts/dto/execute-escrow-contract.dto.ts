import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ExecuteEscrowContractInDto {
	@ApiProperty({ type: "string" })
	@IsString()
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

	@ApiProperty({ description: "VTXOs for this execution" })
	vtxos!: [
		{
			txid: string;
			vout: number;
			value: number;
		},
	];
}
