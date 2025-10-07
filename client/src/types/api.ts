// TODO: generate from OpenAPI spec

export type ApiPaginatedMeta = {
	nextCursor?: string;
	total: number;
};

export type ApiPaginatedEnvelope<T> = {
	data: T[];
	meta: ApiPaginatedMeta;
};

export type ApiEnvelope<T> = {
	data: T;
};

export type GetEscrowRequestDto = {
	externalId: string;
	side: "receiver" | "sender";
	creatorPublicKey: string;
	amount: number;
	description: string;
	public: boolean;
	status: "open" | "cancelled";
	contractsCount: number;
	createdAt: number;
};
