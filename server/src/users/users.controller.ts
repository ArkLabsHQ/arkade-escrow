import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";

@ApiTags("Users")
@Controller("api/v1/users")
export class UsersController {
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: will be used later
	constructor(private users: UsersService) {}

	// DELETE /users/{user_id}
	// TODO:
	//      we should probably have a soft delete here with anonymized data (GDPR)?
	//      what happens to escrows if users delete their account?
}
