import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { Repository } from "typeorm";
import { AuthGuard } from "./auth.guard";
import { User } from "../users/user.entity";
import { HttpArgumentsHost } from "@nestjs/common/interfaces";
import Mocked = jest.Mocked;

describe("AuthGuard", () => {
	let authGuard: AuthGuard;
	let jwtService: JwtService;
	let userRepository: jest.Mocked<Repository<User>>;

	beforeEach(async () => {
		userRepository = {
			findOne: jest.fn(),
			// Mock other methods if needed
		} as unknown as Mocked<Repository<User>>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthGuard,
				{
					provide: JwtService,
					useValue: {
						verify: jest.fn(),
					},
				},
				{
					provide: "UserRepository",
					useValue: userRepository,
				},
			],
		}).compile();

		authGuard = module.get<AuthGuard>(AuthGuard);
		jwtService = module.get<JwtService>(JwtService);
	});

	it("should throw UnauthorizedException if no Authorization header is provided", async () => {
		const context: Partial<ExecutionContext> = {
			switchToHttp: () =>
				({
					getRequest: () => ({ headers: {} }),
				}) as unknown as HttpArgumentsHost,
		};

		await expect(
			authGuard.canActivate(context as ExecutionContext),
		).rejects.toThrow(
			new UnauthorizedException("Missing Authentication header"),
		);
	});

	it("should throw UnauthorizedException if the Authorization header format is invalid", async () => {
		const context: Partial<ExecutionContext> = {
			switchToHttp: () =>
				({
					getRequest: () => ({
						headers: { authorization: "InvalidFormat" },
					}),
				}) as unknown as HttpArgumentsHost,
		};

		await expect(
			authGuard.canActivate(context as ExecutionContext),
		).rejects.toThrow(
			new UnauthorizedException("Invalid Authentication format"),
		);
	});

	it("should throw UnauthorizedException if the token is invalid", async () => {
		jwtService.verify = jest.fn(() => {
			throw new Error("Invalid token");
		});

		const context: Partial<ExecutionContext> = {
			switchToHttp: () =>
				({
					getRequest: () => ({
						headers: { authorization: "Bearer invalid_token" },
					}),
				}) as unknown as HttpArgumentsHost,
		};

		await expect(
			authGuard.canActivate(context as ExecutionContext),
		).rejects.toThrow(UnauthorizedException);
	});

	it("should throw UnauthorizedException if the user is not found", async () => {
		jwtService.verify = jest.fn(() => ({
			sub: "123",
		})) as unknown as typeof jwtService.verify;
		userRepository.findOne.mockResolvedValue(null);

		const context: Partial<ExecutionContext> = {
			switchToHttp: () =>
				({
					getRequest: () => ({
						headers: { authorization: "Bearer valid_token" },
					}),
				}) as unknown as HttpArgumentsHost,
		};

		await expect(
			authGuard.canActivate(context as ExecutionContext),
		).rejects.toThrow(new UnauthorizedException("User has pending challenge"));
	});

	it("should throw UnauthorizedException if the user has a pending challenge", async () => {
		jwtService.verify = jest.fn(() => ({
			sub: "123",
		})) as unknown as typeof jwtService.verify;
		userRepository.findOne.mockResolvedValue({
			id: "123",
			pendingChallenge: true,
		} as unknown as User);

		const context: Partial<ExecutionContext> = {
			switchToHttp: () =>
				({
					getRequest: () => ({
						headers: { authorization: "Bearer valid_token" },
					}),
				}) as unknown as HttpArgumentsHost,
		};

		await expect(
			authGuard.canActivate(context as ExecutionContext),
		).rejects.toThrow(new UnauthorizedException("User has pending challenge"));
	});

	it("should return true and attach user details to the request object when valid token and user are provided", async () => {
		jwtService.verify = jest.fn(() => ({
			sub: "123",
		})) as unknown as typeof jwtService.verify;
		userRepository.findOne.mockResolvedValue({
			id: "123",
			pendingChallenge: false,
			publicKey: "public_key",
		} as unknown as User);

		const req = {
			headers: { authorization: "Bearer valid_token" },
			user: undefined,
		};

		const context: Partial<ExecutionContext> = {
			switchToHttp: () =>
				({
					getRequest: () => req,
				}) as unknown as HttpArgumentsHost,
		};

		const result = await authGuard.canActivate(context as ExecutionContext);

		expect(result).toBe(true);
		expect(req.user).toEqual({ userId: "123", publicKey: "public_key" });
	});
});
