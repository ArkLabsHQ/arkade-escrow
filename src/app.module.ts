import { ConfigModule } from "@nestjs/config";
import {
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

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		TypeOrmModule.forRoot(AppDataSourceConfig),
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
