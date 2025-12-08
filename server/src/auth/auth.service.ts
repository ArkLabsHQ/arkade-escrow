import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	UnauthorizedException,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { hexToBytes } from "@noble/hashes/utils.js";
import { schnorr } from "@noble/secp256k1";
import type { Repository } from "typeorm";
import {
	ChallengePayload,
	createSignupChallenge,
	hashSignupPayload,
} from "../crypto/challenge";
import { User } from "../users/user.entity";

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		@InjectRepository(User) private readonly users: Repository<User>,
		private readonly jwt: JwtService,
	) {}

	async createSignupChallenge(publicKeyRaw: string, origin: string) {
		const publicKey = publicKeyRaw; // normalizeToXOnly(publicKeyRaw);
		const now = new Date();

		let user = await this.users.findOne({ where: { publicKey } });
		if (!user) {
			user = this.users.create({ publicKey });
		}

		const { id, payload, hashHex } = createSignupChallenge(origin);
		user.pendingChallenge = JSON.stringify(payload);
		user.challengeId = id;
		user.challengeExpiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);

		try {
			await this.users.save(user);
		} catch (e) {
			this.logger.error("Failed to save user", e);
			throw new InternalServerErrorException("Failed to save user");
		}
		return {
			challenge: payload,
			challengeId: id,
			hashToSignHex: hashHex,
			expiresAt: user.challengeExpiresAt.toISOString(),
		};
	}

	async verifySignup(
		publicKey: string,
		signatureHex: string,
		challengeId: string,
		origin: string,
	) {
		const user = await this.users.findOne({ where: { publicKey } });
		if (!user || !user.pendingChallenge || !user.challengeId) {
			throw new UnauthorizedException("No pending challenge");
		}
		if (user.challengeId !== challengeId) {
			throw new UnauthorizedException("Challenge mismatch");
		}
		if (!user.challengeExpiresAt || user.challengeExpiresAt < new Date()) {
			throw new UnauthorizedException("Challenge expired");
		}

		let payload: ChallengePayload | undefined;
		try {
			payload = JSON.parse(user.pendingChallenge);
		} catch (cause) {
			throw new InternalServerErrorException("Corrupted challenge", { cause });
		}
		if (payload?.origin !== origin || payload?.scope !== "signup") {
			throw new UnauthorizedException("Invalid challenge scope or origin");
		}

		const hashHex = hashSignupPayload(payload);
		let ok = false;
		try {
			ok = schnorr.verify(
				hexToBytes(signatureHex),
				hexToBytes(hashHex),
				hexToBytes(publicKey),
			);
		} catch (cause) {
			throw new BadRequestException("Invalid signature input", { cause });
		}
		if (!ok) {
			throw new UnauthorizedException("Invalid signature");
		}

		user.pendingChallenge = null;
		user.challengeId = null;
		user.challengeExpiresAt = null;
		user.lastLoginAt = new Date();

		this.logger.debug("User logged in", {
			publicKey,
		});
		try {
			await this.users.save(user);
		} catch (e) {
			this.logger.error("Failed to save user", e);
			throw new InternalServerErrorException("Failed to save user");
		}

		const accessToken = await this.jwt.signAsync({
			sub: user.id,
		});
		return {
			accessToken,
			expiresAt: 0,
			userId: user.id,
			publicKey: user.publicKey,
		};
	}

	async getSession(token: string) {
		try {
			await this.jwt.verifyAsync(token);
			const decoded = this.jwt.decode<{
				sub: string;
			}>(token);
			const user = await this.users.findOne({
				where: { id: decoded.sub },
			});
			if (user) {
				return { userId: user.id, publicKey: user.publicKey };
			}
			return new NotFoundException("Session not found") as never;
		} catch (e) {
			this.logger.error("Invalid token", e);
			throw new UnauthorizedException("Invalid token");
		}
	}
}
