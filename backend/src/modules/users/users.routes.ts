/**
 * File: src/modules/users/users.routes.ts
 * Purpose: Register REST endpoints for user administration.
 * Why: Provides a stable routing layer that aligns with the layered architecture.
 */
import { UserRole } from "../../prisma/index.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { getUser, getUsers, postUser } from "./users.controller.js";

export const userRouter = Router();

userRouter.use(authGuard);
userRouter.use(roleGuard([UserRole.admin]));

userRouter.get("/", getUsers);
userRouter.post("/", postUser);
userRouter.get("/:userId", getUser);
