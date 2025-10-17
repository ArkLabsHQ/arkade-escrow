import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RestArkProvider } from "@arkade-os/sdk";
import { ArkService } from "./ark.service";
import { ARK_PROVIDER } from "./ark.constants";
import { ArkFundingWatcher } from "./funding-watcher.service";

@Module({
	imports: [ConfigModule.forRoot()],
	providers: [
		{
			provide: ARK_PROVIDER,
			inject: [ConfigService],
			useFactory: (cfg: ConfigService) => {
				const arkServerUrl = cfg.get<string>("ARK_SERVER_URL");
				console.log("ARK_SERVER_URL", arkServerUrl);
				return new RestArkProvider(
					arkServerUrl ?? "https://mutinynet.arkade.sh",
				);
			},
		},
		ArkService,
		ArkFundingWatcher,
	],
	exports: [ArkService, ARK_PROVIDER, ArkFundingWatcher],
})
export class ArkModule {}
