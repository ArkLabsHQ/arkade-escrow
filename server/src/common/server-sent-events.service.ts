import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { filter, Subject } from "rxjs";
import {
	CONTRACT_CREATED_ID,
	CONTRACT_DRAFTED_ID,
	CONTRACT_EXECUTED_ID,
	CONTRACT_FUNDED_ID,
	CONTRACT_VOIDED_ID,
	type ContractCreated,
	type ContractDrafted,
	type ContractExecuted,
	type ContractFunded,
	type ContractVoided,
} from "./contract-address.event";
import { User } from "../users/user.entity";

type ArkSse =
	| { type: "new_contract"; externalId: string }
	| { type: "contract_updated"; externalId: string };

// biome-ignore lint/suspicious/noExplicitAny: just anything remotely JSON-serializable
export type SseEvent<T = any> = {
	data: T;
};

@Injectable()
export class ServerSentEventsService {
	private readonly events$ = new Subject<ArkSse>();

	get adminEvents() {
		return this.events$.asObservable();
	}

	userEvents(/* user: User */) {
		// TODO: filter events by user
		return this.events$.asObservable();
	}

	@OnEvent(CONTRACT_DRAFTED_ID)
	onContractDrafted(evt: ContractDrafted) {
		this.events$.next({ type: "new_contract", externalId: evt.contractId });
	}

	@OnEvent(CONTRACT_CREATED_ID)
	onContractCreated(evt: ContractCreated) {
		this.events$.next({ type: "contract_updated", externalId: evt.contractId });
	}

	@OnEvent(CONTRACT_FUNDED_ID)
	onContractFunded(evt: ContractFunded) {
		this.events$.next({ type: "contract_updated", externalId: evt.contractId });
	}

	@OnEvent(CONTRACT_VOIDED_ID)
	onContractVoided(evt: ContractVoided) {
		this.events$.next({ type: "contract_updated", externalId: evt.contractId });
	}

	@OnEvent(CONTRACT_EXECUTED_ID)
	onContractExecuted(evt: ContractExecuted) {
		this.events$.next({ type: "contract_updated", externalId: evt.contractId });
	}
}
