import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString, Min } from "class-validator";
import { CONTRACT_STATUS, ContractStatus } from "../escrow-contract.entity";

export class EnterEscrowContractInDto {
	@ApiProperty({ description: "The ARK address to be used for this contract" })
	@IsString()
	@IsNotEmpty()
	arkAddress!: string;
}
