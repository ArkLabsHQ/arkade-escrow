import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "./auth/auth.module";
import { EscrowContract } from "./escrows/contracts/escrow-contract.entity";
import { EscrowRequest } from "./escrows/requests/escrow-request.entity";
import { HealthModule } from "./health.module";
import { User } from "./users/user.entity";
import { UsersModule } from "./users/users.module";
import { EscrowsModule } from "./escrows/escrows.module";

const isTest = process.env.NODE_ENV === "test";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		TypeOrmModule.forRootAsync({
			useFactory: () => ({
				type: "sqlite",
				database: isTest
					? ":memory:"
					: (process.env.SQLITE_DB_PATH ?? "./data/ark-escrow.sqlite"),
				entities: [User, EscrowRequest, EscrowContract],
				synchronize: true,
			}),
		}),
		AuthModule,
		EscrowsModule,
		UsersModule,
		HealthModule,
	],
})
export class AppModule {}
