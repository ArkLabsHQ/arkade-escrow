import { useEffect, useState } from "react";
import Config from "@/Config";

type ContractSseEvent = {
	type: "contract_updated";
	id: string;
};

/**
 * Subscribe to SSE events for a contract.
 * @param externalId Contract's ID
 * @param onContractUpdate
 */
export function useContractSse(
	externalId: string,
	onContractUpdate?: (externalId: string) => void,
) {
	const [lastEvent, setLastEvent] = useState<ContractSseEvent | undefined>();
	const [connection, setConnection] = useState<EventSource | null>(null);
	useEffect(() => {
		if (connection) {
			return;
		}

		const eventSource = new EventSource(
			`${Config.apiBaseUrl}/escrows/contracts/sse?id=${externalId}`,
		);

		eventSource.onmessage = (event) => {
			try {
				const data: ContractSseEvent | undefined = JSON.parse(event.data);
				switch (data?.type) {
					case "contract_updated":
						onContractUpdate?.(externalId);
						setLastEvent({ ...data, id: event.lastEventId });
						break;
					default:
					// ignore
				}
			} catch (error) {
				console.error("Error parsing SSE event:", error);
			}
		};

		eventSource.onerror = (error) => {
			console.error("SSE connection error:", error);
		};

		setConnection(eventSource);

		return () => {
			eventSource.close();
		};
	}, [externalId]);
	return lastEvent;
}
