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
import { EscrowContract } from "./escrows/contracts/escrow-contract.entity";
import { EscrowRequest } from "./escrows/requests/escrow-request.entity";
import { HealthModule } from "./health.module";
import { User } from "./users/user.entity";
import { UsersModule } from "./users/users.module";
import { EscrowsModule } from "./escrows/escrows.module";
import { RequestLoggingMiddleware } from "./common/middlewares/request-logging.middleware";

const isTest = process.env.NODE_ENV === "test";

Logger.log(`Running in ${process.env.NODE_ENV} mode`);
Logger.log(`SQLite DB path: ${process.env.SQLITE_DB_PATH}`);

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
