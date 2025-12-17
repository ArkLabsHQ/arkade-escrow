import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsString } from "class-validator";

export class GetArkInfoOutDto {
	@ApiProperty({
		description: "Escrow Server Public Key",
		example: "9a99c66a064f18f93377ff5c194506d43925da02aad7897ecb56ce5e747b08e3",
	})
	@IsString()
	escrowServerPublicKey!: string;

	@ApiProperty({ description: "Ark Server URL" })
	@IsString()
	arkServerUrl!: string;

	@ApiProperty({ description: "Network" })
	@IsString()
	network!: string;

	@ApiProperty({ description: "Dust threshold as BigInt" })
	@IsNumber()
	dust!: string;

	@ApiProperty({
		description: "Whether the server is running in demo mode",
		example: false,
	})
	@IsBoolean()
	demoMode!: boolean;
}
