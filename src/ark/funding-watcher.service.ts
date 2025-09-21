import {
	Injectable,
	Logger,
	OnModuleInit,
	OnModuleDestroy,
} from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { randomUUID } from "node:crypto";
import {
	ContractAddressCreatedEvent,
	ContractAddressFundedEvent,
	ContractAddressVoidedEvent,
} from "../common/ContractAddress";
import { ArkService } from "./ark.service";
import { ArkAddress, VirtualCoin } from "@arkade-os/sdk";
// import your event types

type WatchEntry = {
	contractId: string;
	arkAddress: ArkAddress;
	lastKnownVtxoIds: Set<string>;
	nextCheckAt: number;
	errorBackoffMs: number;
};

@Injectable()
export class ArkFundingWatcher implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(ArkFundingWatcher.name);

	// in-memory watch state
	private readonly watchMap = new Map<string, WatchEntry>(); // key by arkAddress
	private timer: NodeJS.Timeout | null = null;

	// tuning knobs
	private readonly tickMs = 2_000; // how often the loop wakes up
	private readonly batchSize = 64; // how many addresses to scan per tick
	private readonly concurrency = 8; // max concurrent provider calls
	private readonly defaultBackoffMs = 5_000; // time between checks per address
	private readonly maxBackoffMs = 60_000;

	constructor(
		private readonly events: EventEmitter2,
		private readonly arkService: ArkService,
	) {}

	onModuleInit() {
		this.logger.log("Starting ArkFundingWatcher loop");
		this.timer = setInterval(() => this.tick(), this.tickMs);
	}

	onModuleDestroy() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.logger.log("Stopped ArkFundingWatcher loop");
	}

	// Event handlers to maintain the watch set

	@OnEvent("contracts.address.created")
	onAddressCreated(evt: ContractAddressCreatedEvent) {
		const lastKnownVtxoIds =
			this.watchMap.get(evt.arkAddress.encode())?.lastKnownVtxoIds ?? new Set();
		this.watchMap.set(evt.arkAddress.encode(), {
			contractId: evt.contractId,
			arkAddress: evt.arkAddress,
			lastKnownVtxoIds,
			nextCheckAt: Date.now(),
			errorBackoffMs: this.defaultBackoffMs,
		});
		this.logger.debug(
			`Watching ${evt.arkAddress} for contract ${evt.contractId}`,
		);
	}

	@OnEvent("contracts.address.voided")
	onAddressVoided(evt: ContractAddressVoidedEvent) {
		this.watchMap.delete(evt.arkAddress.encode());
		this.logger.debug(`Stopped watching ${evt.arkAddress} (voided)`);
	}

	// TODO: generated with AI, can certainly be improved
	private async tick(): Promise<void> {
		const now = Date.now();

		// Pick up to batchSize addresses due for check
		const due: WatchEntry[] = [];
		for (const entry of this.watchMap.values()) {
			if (entry.nextCheckAt <= now) {
				due.push(entry);
				if (due.length >= this.batchSize) break;
			}
		}
		if (due.length === 0) return;

		// Concurrency-limited checks
		const chunks: WatchEntry[][] = [];
		for (let i = 0; i < due.length; i += this.concurrency) {
			chunks.push(due.slice(i, i + this.concurrency));
		}

		for (const chunk of chunks) {
			await Promise.all(chunk.map((entry) => this.checkOne(entry)));
		}
	}

	private async checkOne(entry: WatchEntry): Promise<void> {
		try {
			const vtxos = await this.arkService.getSpendableVtxoForContract(
				entry.arkAddress,
			);

			const newFunds: VirtualCoin[] = [];
			for (const vtxo of vtxos) {
				// TODO: is txid unique per VirtualCoin?
				if (!entry.lastKnownVtxoIds.has(vtxo.txid)) {
					newFunds.push(vtxo);
					entry.lastKnownVtxoIds.add(vtxo.txid);
				}
			}

			if (newFunds.length > 0) {
				entry.errorBackoffMs = this.defaultBackoffMs;
				entry.nextCheckAt = Date.now() + this.defaultBackoffMs;

				// Emit funded event
				const fundedEvent: ContractAddressFundedEvent = {
					eventId: randomUUID(),
					contractId: entry.contractId,
					arkAddress: entry.arkAddress,
					amountSats: BigInt(
						newFunds.reduce((sum, vtxo) => sum + vtxo.value, 0),
					),
					vtxoIds: newFunds.map((vtxo) => vtxo.txid),
					detectedAt: new Date().toISOString(),
				};
				this.events.emit("contracts.address.funded", fundedEvent);
				this.logger.log(
					`Funding detected for ${entry.arkAddress} (contract ${entry.contractId})`,
				);
			} else {
				// No change
				entry.errorBackoffMs = this.defaultBackoffMs;
				entry.nextCheckAt = Date.now() + this.defaultBackoffMs;
			}
		} catch (err) {
			// Backoff on error, with cap
			entry.errorBackoffMs = Math.min(
				entry.errorBackoffMs * 2,
				this.maxBackoffMs,
			);
			entry.nextCheckAt = Date.now() + entry.errorBackoffMs;
			this.logger.warn(
				`Error checking ${entry.arkAddress}: ${(err as Error).message}`,
			);
		}
	}
}
