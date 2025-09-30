import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { User } from "./user.entity";

@Injectable()
export class UsersService {
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: TODO work on users
	constructor(@InjectRepository(User) private repo: Repository<User>) {}
}
