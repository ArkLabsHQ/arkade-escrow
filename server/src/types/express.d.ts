// src/types/express.d.ts
import type { AuthUser } from "../common/AuthUser";

declare module "express-serve-static-core" {
	// Augmentation of the Express Request object to include the user property everywhere
	interface Request {
		user?: AuthUser;
	}
}
