import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class AdminUpdateExecutionInDto {
	@ApiProperty({ description: "Cancelation reason" })
	@IsString()
	@IsOptional()
	cancelationReason?: string;
}
