import { useEffect, useState } from "react";
import Config from "@/Config";

type ContractSseEvent = {
	type: "contract_updated";
};

/**
 * Subscribe to SSE events for a contract.
 * @param externalId Contract's ID
 * @param onContractUpdate
 */
export function useContractSse(
	externalId: string,
	onContractUpdate: (externalId: string) => void,
) {
	const [lastEvent, setLastEvent] = useState<ContractSseEvent | undefined>();
	useEffect(() => {
		const eventSource = new EventSource(
			`${Config.apiBaseUrl}/escrows/contracts/sse?id=${externalId}`,
		);

		eventSource.onmessage = (event) => {
			try {
				const data: ContractSseEvent | undefined = JSON.parse(event.data);
				switch (data?.type) {
					case "contract_updated":
						onContractUpdate(externalId);
						setLastEvent(data);
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

		return () => {
			eventSource.close();
		};
	}, [externalId, onContractUpdate]);
	return lastEvent;
}
