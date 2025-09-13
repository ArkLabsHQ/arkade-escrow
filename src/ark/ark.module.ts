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
			useFactory: async (cfg: ConfigService) => {
				// biome-ignore lint/style/noNonNullAssertion: default value is set
				const baseUrl = cfg.get<string>(
					"ARK_SERVER_URL",
					"https://mutinynet.arkade.sh",
				)!;
				const provider = new RestArkProvider(baseUrl);
				// Quick readiness check
				await provider.getInfo();
				return provider;
			},
		},
		ArkService,
	],
	exports: [ArkService, ARK_PROVIDER],
})
export class ArkModule {}
