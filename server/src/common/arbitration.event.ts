export const ARBITRATION_RESOLVED = "arbitration.resolved";
export type ArbitrationResolved = {
	eventId: string;
	contractId: string;
	arbitrationId: string;
	resolvedAt: string; // ISO timestamp
};
