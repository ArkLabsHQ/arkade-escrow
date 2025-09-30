import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();

		let status = HttpStatus.INTERNAL_SERVER_ERROR;
		let errors: string[] = ["Internal server error"];

		if (exception) {
			if (exception instanceof HttpException) {
				status = exception.getStatus();
				errors = getErrorsFromHttpException(exception);
			} else if (
				typeof exception === "object" &&
				"status" in exception &&
				"message" in exception
			) {
				status =
					typeof exception.status === "number" ? exception.status : status;
				errors =
					typeof exception.message === "string" ? [exception.message] : errors;
			} else if (exception instanceof Error) {
				errors = [exception.message];
			}
		}

		response.status(status).json({ errors });
	}
}

function getErrorsFromHttpException(exception: HttpException): string[] {
	const res = exception.getResponse();
	if (res) {
		if (typeof res === "string") {
			return [res];
		}
		if (Array.isArray(res)) {
			return res.map((_: unknown) =>
				typeof _ === "string" ? _ : "invalid message from HttpException",
			);
		}
		if (typeof res === "object" && "message" in res) {
		}
		const r = res as { message: unknown };
		if (Array.isArray(r.message)) {
			return r.message.map((_: unknown) =>
				typeof _ === "string" ? _ : "invalid message from HttpException",
			);
		}
		return [
			typeof r.message === "string"
				? r.message
				: "invalid message from HttpException",
		];
	}
	return [];
}
