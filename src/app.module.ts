import { ConfigModule } from "@nestjs/config";
import {
	Logger,
	MiddlewareConsumer,
	Module,
	NestModule,
	RequestMethod,
} from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health.module";
import { UsersModule } from "./users/users.module";
import { EscrowsModule } from "./escrows/escrows.module";
import { RequestLoggingMiddleware } from "./common/middlewares/request-logging.middleware";
import AppDataSourceConfig from "./db/DataSource";
import { User } from "./users/user.entity";
import { EscrowRequest } from "./escrows/requests/escrow-request.entity";
import { EscrowContract } from "./escrows/contracts/escrow-contract.entity";
import { existsSync } from "node:fs";
const isTest = process.env.NODE_ENV === "test";

Logger.log(`AppModule - looking for ${process.env.SQLITE_DB_PATH}`);
if (existsSync(process.env.SQLITE_DB_PATH!)) {
	Logger.log(`AppModule - ${process.env.SQLITE_DB_PATH} exists`);
} else {
	Logger.log(`AppModule - ${process.env.SQLITE_DB_PATH} does not exist`);
}
/*

[Nest] 1  - 09/16/2025, 1:50:05 PM     LOG AppModule - looking for data/db.sqlite
[Nest] 1  - 09/16/2025, 1:50:05 PM     LOG AppModule - data/db.sqlite does not exist
 */

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		TypeOrmModule.forRootAsync({
			useFactory: () => ({
				type: "sqlite",
				database: isTest ? ":memory:" : process.env.SQLITE_DB_PATH,
				entities: [User, EscrowRequest, EscrowContract],
				synchronize: true,
				logging: true,
			}),
		}),
		AuthModule,
		EscrowsModule,
		UsersModule,
		HealthModule,
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer
			.apply(RequestLoggingMiddleware)
			.forRoutes({ path: "*", method: RequestMethod.ALL });
	}
}
