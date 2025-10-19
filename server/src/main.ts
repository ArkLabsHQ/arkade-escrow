import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { hashes } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { NextFunction } from "express";

dotenv.config();

// CRITICAL: Set up the hash function for secp256k1
hashes.sha256 = sha256;

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Rewrite bare /assets/* depending on current app scope:
	// - When under /client/* -> /client/assets/*
	// - When under /backoffice/* -> /backoffice/assets/*
	app.use((req: Request, _res: Response, next: NextFunction) => {
		// Only touch bare /assets/* that aren't already scoped
		if (req.url.startsWith("/assets/")) {
			// Detect referring page path to infer scope from the URL the browser is requesting from
			// If the current request path begins with an app scope, rewrite accordingly.

			// @ts-expect-error
			if (req.headers.referer?.includes("/client/")) {
				// @ts-expect-error
				req.url = `/client${req.url}`;
			}

			// @ts-expect-error
			if (req.headers.referer?.includes("/backoffice/")) {
				// @ts-expect-error
				req.url = `/backoffice${req.url}`;
			}
			// If neither matches, leave as-is (you may choose a default if desired)
		}
		next();
	});

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
