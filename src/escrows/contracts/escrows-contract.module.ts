import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EscrowsContractsService } from "./escrows-contracts.service";
import { EscrowsContractsController } from "./escrows-contracts.controller";
import { ArkService } from "../../ark/ark.service";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { EscrowContract } from "./escrow-contract.entity";
import { AuthModule } from "../../auth/auth.module";
import { UsersModule } from "../../users/users.module";
import { User } from "../../users/user.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([EscrowContract, EscrowRequest, User]),
		AuthModule,
	],
	providers: [EscrowsContractsService, ArkService],
	controllers: [EscrowsContractsController],
	exports: [EscrowsContractsService],
})
export class EscrowsContractModule {}
