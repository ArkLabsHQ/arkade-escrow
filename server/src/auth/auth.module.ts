import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { Repository } from "typeorm";

@Module({
	imports: [
		TypeOrmModule.forFeature([User]),
		JwtModule.register({
			secret: process.env.JWT_SECRET ?? "dev-secret",
			signOptions: { expiresIn: "7d" },
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, AuthGuard, Repository<User>],
	exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}
