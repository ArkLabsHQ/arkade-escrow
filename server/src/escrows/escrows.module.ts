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
import { ContractArbitration } from "./arbitration/contract-arbitration.entity";
import { ArbitrationService } from "./arbitration/arbitration.service";
import { ArbitrationController } from "./arbitration/arbitration.controller";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EscrowContract,
			EscrowRequest,
			User,
			ContractExecution,
			ContractArbitration,
		]),
		AuthModule,
		ArkModule,
	],
	providers: [
		EscrowsContractsService,
		EscrowRequestsService,
		ArbitrationService,
	],
	controllers: [
		EscrowsContractsController,
		EscrowRequestsController,
		ArbitrationController,
	],
	exports: [EscrowsContractsService, EscrowRequestsService, ArbitrationService],
})
export class EscrowsModule {}
