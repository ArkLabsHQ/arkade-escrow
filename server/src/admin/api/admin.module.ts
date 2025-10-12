import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { ContractArbitration } from "../../escrows/arbitration/contract-arbitration.entity";
import { EscrowContract } from "../../escrows/contracts/escrow-contract.entity";
import { EscrowRequest } from "../../escrows/requests/escrow-request.entity";
import { User } from "../../users/user.entity";
import { ContractExecution } from "../../escrows/contracts/contract-execution.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EscrowContract,
			EscrowRequest,
			User,
			ContractExecution,
			ContractArbitration,
		]),
	],
	controllers: [AdminController],
	providers: [AdminService],
})
export class AdminModule {}
