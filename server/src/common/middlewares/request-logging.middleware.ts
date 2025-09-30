import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
	use(req: Request, res: Response, next: NextFunction) {
		const { method, path } = req;
		const message = `${method} ${path}`;

		Logger.log(message, "IncomingRequest");

		res.on("finish", () => {
			const { statusCode } = res;
			const responseMessage = `${method} ${path} ${statusCode}`;
			Logger.log(responseMessage, "OutgoingResponse");
		});

		next();
	}
}
