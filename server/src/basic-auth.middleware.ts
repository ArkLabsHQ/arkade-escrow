import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BasicAuthMiddleware implements NestMiddleware {
	constructor(private readonly config: ConfigService) {}

	use(req: Request, res: Response, next: NextFunction) {
		const header = req.header("authorization");
		if (!header || !header.startsWith("Basic ")) {
			res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
			return res.status(401).send("Authentication required");
		}

		const base64 = header.slice("Basic ".length).trim();
		let decoded: string;
		try {
			decoded = Buffer.from(base64, "base64").toString("utf8");
		} catch {
			res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
			return res.status(401).send("Invalid credentials");
		}

		const sep = decoded.indexOf(":");
		const username = sep >= 0 ? decoded.slice(0, sep) : "";
		const password = sep >= 0 ? decoded.slice(sep + 1) : "";

		const expectedUser = this.config.get<string>("BACKOFFICE_BASIC_USER") ?? "";
		const expectedPass = this.config.get<string>("BACKOFFICE_BASIC_PASS") ?? "";

		const ok =
			timingSafeEqual(username, expectedUser) &&
			timingSafeEqual(password, expectedPass);
		if (!ok) {
			res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
			return res.status(401).send("Unauthorized");
		}

		return next();
	}
}

function timingSafeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	if (ab.length !== bb.length) {
		// Compare with same length to avoid leak
		const pad = Buffer.alloc(Math.max(ab.length, bb.length), 0);
		try {
			require("node:crypto").timingSafeEqual(
				ab.length > bb.length ? ab : pad,
				ab.length > bb.length ? ab : pad,
			);
		} catch {}
		return false;
		return false;
	}
	try {
		return require("node:crypto").timingSafeEqual(ab, bb);
	} catch {
		return a === b;
	}
}
