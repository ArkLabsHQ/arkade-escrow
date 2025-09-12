import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";

@ApiTags("Health")
@Controller("api/v1/health")
export class HealthController {
	constructor(private readonly configService: ConfigService) {}

	@Get()
	@ApiOperation({ summary: "Health check endpoint" })
	@ApiResponse({
		status: 200,
		description: "Application is healthy",
		schema: {
			type: "object",
			properties: {
				status: { type: "string", example: "ok" },
				timestamp: { type: "string", example: "2025-08-26T10:00:00.000Z" },
				uptime: { type: "number", example: 12345 },
				environment: { type: "string", example: "production" },
			},
		},
	})
	healthCheck() {
		return {
			status: "ok",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			environment: this.configService.get("NODE_ENV", "development"),
		};
	}
}
