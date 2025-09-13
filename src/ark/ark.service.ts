// libs/ark/ark.service.ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { VEscrow } from "./escrow";
import { ArkInfo, RelativeTimelock, RestArkProvider } from "@arkade-os/sdk";
import { ConfigService } from "@nestjs/config";
import { ARK_PROVIDER } from "./ark.constants";
import { hex } from "@scure/base";

export type ArkNetwork =
	| "bitcoin"
	| "testnet"
	| "signet"
	| "regtest"
	| "mutinynet";

export type ContractParty = { pubKey: string };
export type EscrowContract = {
	receiver: ContractParty;
	sender: ContractParty;
	arbitrator: ContractParty;
};

/**
 * Thin seam around Arkade SDK's escrow address derivation, aligned with
 * Kukks' demo (2-of-3 sender/receiver/arbitrator keys).
 */
@Injectable()
export class ArkService {
	private readonly logger = new Logger(ArkService.name);
	private arkInfo: ArkInfo | undefined;

	constructor(
		@Inject(ARK_PROVIDER) private readonly provider: RestArkProvider,
	) {}

	async onModuleInit() {
		this.arkInfo = await this.provider.getInfo();
	}

	async onModuleDestroy() {
		// TODO: anything to clean up on Ark side?
	}

	createArkAddressForContract(contract: EscrowContract): string {
		if (this.arkInfo === undefined) {
			throw new Error("ARK info not loaded");
		}
		const escrowScript = ArkService.restoreScript(contract, this.arkInfo);
		const addrPrefix = ArkService.getAddrPrefix(this.arkInfo);
		const serverKey = ArkService.getServerKey(this.arkInfo);
		const arkAddress = escrowScript.address(addrPrefix, hex.decode(serverKey));
		return arkAddress.encode();
	}

	static restoreScript(
		contract: EscrowContract,
		arkInfo: ArkInfo,
	): VEscrow.Script {
		return new VEscrow.Script({
			unilateralDelay: ArkService.getUnilateralDelay(arkInfo),
			buyer: hex.decode(contract.receiver.pubKey),
			seller: hex.decode(contract.sender.pubKey),
			arbitrator: hex.decode(contract.arbitrator.pubKey),
			server: hex.decode(ArkService.getServerKey(arkInfo)),
		});
	}

	static getUnilateralDelay(arkInfo: ArkInfo): RelativeTimelock {
		return {
			type: arkInfo.unilateralExitDelay < 512 ? "blocks" : "seconds",
			value: arkInfo.unilateralExitDelay,
		};
	}

	static getServerKey(arkInfo: ArkInfo): string {
		return arkInfo.signerPubkey.slice(2);
	}

	static getAddrPrefix(arkInfo: ArkInfo): string {
		return arkInfo.network === "mainnet" ? "ark" : "tark";
	}
}
