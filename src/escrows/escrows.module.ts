import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EscrowsContractsService } from "./contracts/escrows-contracts.service";
import { EscrowsContractsController } from "./contracts/escrows-contracts.controller";
import { ArkService } from "../ark/ark.service";
import { EscrowRequest } from "./requests/escrow-request.entity";
import { EscrowContract } from "./contracts/escrow-contract.entity";
import { AuthModule } from "../auth/auth.module";
import { User } from "../users/user.entity";
import { EscrowsService } from "./escrows.service";
import { EscrowRequestsService } from "./requests/escrow-requests.service";
import { EscrowRequestsController } from "./requests/escrow-requests.controller";

@Module({
	imports: [
		TypeOrmModule.forFeature([EscrowContract, EscrowRequest, User]),
		AuthModule,
	],
	providers: [
		EscrowsService,
		EscrowsContractsService,
		EscrowRequestsService,
		ArkService,
	],
	controllers: [EscrowsContractsController, EscrowRequestsController],
	exports: [EscrowsContractsService, EscrowRequestsService, EscrowsService],
})
export class EscrowsModule {}
