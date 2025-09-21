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

export type Cursor = {
	createdBefore?: Date;
	idBefore?: number;
};
export const emptyCursor: Cursor = {
	createdBefore: undefined,
	idBefore: undefined,
};

/**
 * Parses a base64-encoded cursor string into an object with a timestamp and an ID.
 * Fails gracefully if the cursor is invalid.
 *
 * @param {string} cursor - The base64-encoded string representing the cursor.
 * @return {Object} An object containing the parsed cursor data:
 *                  - `createdBefore` (number | undefined): The timestamp extracted from the cursor, or `undefined` if invalid.
 *                  - `idBefore` (number | undefined): The ID extracted from the cursor, or `undefined` if invalid.
 */
export function cursorFromString(cursor: string): Cursor {
	const raw = Buffer.from(cursor, "base64").toString("utf8");
	const [tsStr, idStr] = raw.split(":");
	const ts = Number(tsStr);
	const idNum = Number(idStr);
	return {
		createdBefore: Number.isFinite(ts) ? new Date(ts) : undefined,
		idBefore: Number.isFinite(idNum) ? idNum : undefined,
	};
}

/**
 * Converts a combination of a date and an identifier into a base64-encoded string.
 *
 * @param {Date} createdAt - The date object representing the creation time.
 * @param {number} id - A unique identifier to be combined with the date.
 * @return {string} A base64-encoded string representation of the combined date and identifier.
 */
export function cursorToString(createdAt: Date, id: number): string {
	return Buffer.from(`${createdAt.getTime()}:${id}`, "utf8").toString("base64");
}

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
