import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { hashes } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";

dotenv.config();

// CRITICAL: Set up the hash function for secp256k1
hashes.sha256 = sha256;

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// biome-ignore lint/correctness/useHookAtTopLevel: backend
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);
	// biome-ignore lint/correctness/useHookAtTopLevel: backend
	app.useGlobalFilters(new HttpExceptionFilter());
	app.enableCors();

	const config = new DocumentBuilder()
		.setTitle("ARK Escrow API")
		.setDescription("Custom header auth: `Authentication: Bearer <jwt>`")
		.setVersion("0.0.2")
		.addBearerAuth(
			{ type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" },
			"bearer",
		)
		.build();
	const doc = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup("api/v1/docs", app, doc, {
		swaggerOptions: {
			tagsSorter: "alpha",
			operationsSorter: "alpha",
			persistAuthorization: true,
		},
	});

	const port = parseInt(process.env.PORT ?? "3000", 10);
	await app.listen(port, "0.0.0.0");
	console.log(`API listening on http://0.0.0.0:${port}`);
}

bootstrap();
