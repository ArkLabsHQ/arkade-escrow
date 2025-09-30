import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EscrowsContractsService } from "./contracts/escrows-contracts.service";
import { EscrowsContractsController } from "./contracts/escrows-contracts.controller";
import { EscrowRequest } from "./requests/escrow-request.entity";
import { EscrowContract } from "./contracts/escrow-contract.entity";
import { AuthModule } from "../auth/auth.module";
import { User } from "../users/user.entity";
import { EscrowRequestsService } from "./requests/escrow-requests.service";
import { EscrowRequestsController } from "./requests/escrow-requests.controller";
import { ArkModule } from "../ark/ark.module";
import { ContractExecution } from "./contracts/contract-execution.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EscrowContract,
			EscrowRequest,
			User,
			ContractExecution,
		]),
		AuthModule,
		ArkModule,
	],
	providers: [EscrowsContractsService, EscrowRequestsService],
	controllers: [EscrowsContractsController, EscrowRequestsController],
	exports: [EscrowsContractsService, EscrowRequestsService],
})
export class EscrowsModule {}
