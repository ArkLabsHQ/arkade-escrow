import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { AuthUser } from "../common/AuthUser";

export const UserFromJwt = createParamDecorator(
	(
		key: keyof AuthUser | undefined,
		ctx: ExecutionContext,
	): string | AuthUser | undefined => {
		const req: Request = ctx.switchToHttp().getRequest();
		// Assuming JwtAuthGuard attaches user: { userId: string, ... }
		return key ? (req as any).user?.[key] : (req as any).user;
	},
);
