import { ApiProperty } from "@nestjs/swagger";

type ContractsStats = {
	total: number;
	active: number;
	disputed: number;
	settled: number;
};

export default class GetAdminStatsDto {
	@ApiProperty({ description: "Statistics for contracts" })
	contracts!: ContractsStats;
}
