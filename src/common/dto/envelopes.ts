import {
	ApiProperty,
	ApiPropertyOptional,
	getSchemaPath,
} from "@nestjs/swagger";

export type ApiPaginatedMeta = {
	nextCursor?: string;
	total: number;
};

export type ApiPaginatedEnvelope<T> = {
	data: T;
	meta: ApiPaginatedMeta;
};

export type ApiEnvelope<T> = {
	data: T;
};

export const envelope = <T>(data?: T): ApiEnvelope<T> => ({
	data: data ?? ({} as T),
});

export const paginatedEnvelope = <T>(
	data: T,
	meta: ApiPaginatedMeta,
): ApiPaginatedEnvelope<T> => ({
	data,
	meta,
});

/**
 * Swagger-only DTOs to describe the envelope in responses.
 * We’ll compose them with `getSchemaPath` in controllers.
 */
export class ApiPaginatedMetaDto implements ApiPaginatedMeta {
	@ApiPropertyOptional({
		description:
			"Opaque cursor to fetch the next page. Omitted when there is no next page.",
		example: "MTczMjc5NDQ2NTAwMDoxMjM0NQ==",
	})
	nextCursor?: string;

	@ApiProperty({
		description: "Total number of items across all pages (for this query).",
		example: 42,
	})
	total!: number;
}

/** Placeholder “envelope” shell; `data` is overridden per-endpoint in controller schemas. */
export class ApiPaginatedEnvelopeShellDto<T> {
	@ApiProperty({
		description: "Payload for this endpoint (shape varies by route)",
	})
	data!: T;

	@ApiProperty({ type: () => ApiPaginatedMetaDto })
	meta!: ApiPaginatedMetaDto;
}

export function getSchemaPathForDto(dto: Parameters<typeof getSchemaPath>[0]) {
	return {
		allOf: [
			{ $ref: getSchemaPath(ApiEnvelopeShellDto) },
			{
				type: "object",
				properties: {
					data: { $ref: getSchemaPath(dto) },
				},
				required: ["data"],
			},
		],
	};
}

export function getSchemaPathForEmptyResponse() {
	return {
		allOf: [
			{ $ref: getSchemaPath(ApiEnvelopeShellDto) },
			{
				type: "object",
				properties: {
					data: {},
				},
				required: ["data"],
			},
		],
	};
}

/** Placeholder “envelope” shell; `data` is overridden per-endpoint in controller schemas. */
export class ApiEnvelopeShellDto<T> {
	@ApiProperty({
		description: "Payload for this endpoint (shape varies by route)",
	})
	data!: T;
}

export function getSchemaPathForPaginatedDto(
	dto: Parameters<typeof getSchemaPath>[0],
) {
	return {
		allOf: [
			{ $ref: getSchemaPath(ApiEnvelopeShellDto) },
			{
				type: "object",
				properties: {
					data: {
						type: "array",
						items: { $ref: getSchemaPath(dto) },
					},
					meta: { $ref: getSchemaPath(ApiPaginatedMetaDto) },
				},
				required: ["data", "meta"],
			},
		],
	};
}
