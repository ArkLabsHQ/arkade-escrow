import { User } from "../users/user.entity";
import { EscrowRequest } from "../escrows/requests/escrow-request.entity";
import { EscrowContract } from "../escrows/contracts/escrow-contract.entity";
import { DataSource, DataSourceOptions } from "typeorm";
import path from "node:path";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";

const isTest = process.env.NODE_ENV === "test";
const isDev = process.env.NODE_ENV === "development";

function buildConfig(): TypeOrmModuleOptions {
	const base = {
		entities: [User, EscrowRequest, EscrowContract],
	};
	if (isTest) {
		return { ...base, type: "sqlite" as const, database: ":memory:" };
	}
	const {
		POSTGRES_HOST,
		POSTGRES_PORT,
		POSTGRES_USER,
		POSTGRES_PASSWORD,
		POSTGRES_DB,
	} = process.env;
	if (
		!POSTGRES_DB ||
		!POSTGRES_PASSWORD ||
		!POSTGRES_USER ||
		!POSTGRES_HOST ||
		!POSTGRES_PORT
	) {
		throw new Error(
			`Missing Postgres env vars. Host ${POSTGRES_HOST}, port ${POSTGRES_PORT}, user ${POSTGRES_USER}, password ${POSTGRES_PASSWORD?.slice(0, 3)}, db ${POSTGRES_DB}`,
		);
	}
	return {
		...base,
		type: "postgres" as const,
		host: POSTGRES_HOST ?? "db",
		port: Number(POSTGRES_PORT),
		username: POSTGRES_USER,
		password: POSTGRES_PASSWORD,
		database: POSTGRES_DB,
		migrations: ["./db/migrations.ts"],
		migrationsTableName: "migrations",
		logging: isDev,
		migrationsRun: true,
	};
}

const AppDataSourceConfig = buildConfig();

export default AppDataSourceConfig;
export const AppDataSource = new DataSource(
	<DataSourceOptions>AppDataSourceConfig,
);
