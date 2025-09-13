import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RestArkProvider } from "@arkade-os/sdk";
import { ArkService } from "./ark.service";
import { ARK_PROVIDER } from "./ark.constants";

@Module({
	imports: [ConfigModule.forRoot()],
	providers: [
		{
			provide: ARK_PROVIDER,
			inject: [ConfigService],
			useFactory: (cfg: ConfigService) => {
				const arkServerUrl = cfg.get<string>("ARK_SERVER_URL");
				return new RestArkProvider(
					arkServerUrl ?? "https://mutinynet.arkade.sh",
				);
			},
		},
		ArkService,
	],
	exports: [ArkService, ARK_PROVIDER],
})
export class ArkModule {}
