import { Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RestArkProvider, RestIndexerProvider } from "@arkade-os/sdk";
import { ArkService } from "./ark.service";
import { ARK_PROVIDER, INDEXER_PROVIDER } from "./ark.constants";
import { ArkFundingWatcher } from "./funding-watcher.service";
import { ArkController } from "./ark.controller";

@Module({
	imports: [ConfigModule.forRoot()],
	providers: [
		{
			provide: ARK_PROVIDER,
			inject: [ConfigService],
			useFactory: (cfg: ConfigService) => {
				const arkServerUrl = cfg.get<string>("ARK_SERVER_URL");
				Logger.log(`ARK_SERVER_URL=${arkServerUrl}`);
				return new RestArkProvider(
					arkServerUrl ?? "https://mutinynet.arkade.sh",
				);
			},
		},
		{
			provide: INDEXER_PROVIDER,
			inject: [ConfigService],
			useFactory: (cfg: ConfigService) => {
				const arkServerUrl = cfg.get<string>("ARK_SERVER_URL");
				return new RestIndexerProvider(
					arkServerUrl ?? "https://mutinynet.arkade.sh",
				);
			},
		},
		ArkService,
		ArkFundingWatcher,
	],
	controllers: [ArkController],
	exports: [ArkService, ARK_PROVIDER, ArkFundingWatcher],
})
export class ArkModule {}
