import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	Logger,
	UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { Repository } from "typeorm";
import { User } from "../users/user.entity";
import { AuthUser } from "../common/AuthUser";

/**
 * Includes validation against pending challenges.
 */
@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = new Logger(AuthGuard.name);

	constructor(
		private readonly jwt: JwtService,
		@InjectRepository(User) private readonly users: Repository<User>,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req: Request = context.switchToHttp().getRequest();
		const header: string | undefined = req.headers.authorization;
		if (!header)
			throw new UnauthorizedException("Missing Authentication header");

		const [scheme, token] = header.split(" ");
		if (!scheme || scheme.toLowerCase() !== "bearer" || !token)
			throw new UnauthorizedException("Invalid Authentication format");

		let payload: { sub: string } | null = null;
		try {
			payload = this.jwt.verify<{ sub: string }>(token);
		} catch (e: unknown) {
			this.logger.error("Invalid token", e);
			throw new UnauthorizedException("Invalid token");
		}
		// TODO: check if JWT has expired
		const user = await this.users.findOne({ where: { id: payload?.sub } });
		if (!user || user.pendingChallenge) {
			throw new UnauthorizedException("User has pending challenge");
		}
		(req as unknown as AuthUser).user = {
			userId: user.id,
			publicKey: user.publicKey,
		};
		return true;
	}
}
