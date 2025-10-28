export type RequestId = string;

export const REQUEST_CREATED_ID = "request.created";
export type RequestCreated = {
	eventId: string;
	requestId: RequestId;
	creatorPubkey: string;
	createdAt: string; // ISO timestamp
};
