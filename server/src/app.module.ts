import { ConfigModule } from "@nestjs/config";
import {
	MiddlewareConsumer,
	Module,
	NestModule,
	RequestMethod,
} from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "node:path";

import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health.module";
import { UsersModule } from "./users/users.module";
import { EscrowsModule } from "./escrows/escrows.module";
import { RequestLoggingMiddleware } from "./common/middlewares/request-logging.middleware";
import { AdminModule } from "./admin/api/admin.module";
import { BasicAuthMiddleware } from "./basic-auth.middleware";

const isTest = process.env.NODE_ENV === "test";
const isDev = process.env.NODE_ENV === "development";

@Module({
	imports: [
		ServeStaticModule.forRoot(
			{
				rootPath: join(process.cwd(), "client", "dist"),
				serveRoot: "/client",
			},
			{
				rootPath: join(process.cwd(), "backoffice", "dist"),
				serveRoot: "/backoffice",
			},
			{
				rootPath: join(process.cwd(), "client", "dist", "assets"),
				serveRoot: "/client/assets",
			},
			{
				rootPath: join(process.cwd(), "backoffice", "dist", "assets"),
				serveRoot: "/backoffice/assets",
			},
		),
		EventEmitterModule.forRoot({
			// optional: wildcard: true, delimiter: '.', etc.
		}),
		ConfigModule.forRoot({ isGlobal: true }),
		TypeOrmModule.forRootAsync({
			useFactory: () => ({
				type: "better-sqlite3",
				database: isTest ? ":memory:" : process.env.SQLITE_DB_PATH,
				synchronize: true,
				// logging: isDev,
				autoLoadEntities: true,
			}),
		}),
		AuthModule,
		EscrowsModule,
		UsersModule,
		HealthModule,
		AdminModule,
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer
			.apply(BasicAuthMiddleware)
			.forRoutes({ path: "backoffice", method: RequestMethod.ALL });

		consumer
			.apply(RequestLoggingMiddleware)
			.exclude({ path: "health", method: RequestMethod.ALL })
			.forRoutes({ path: "*", method: RequestMethod.ALL });
	}
}
