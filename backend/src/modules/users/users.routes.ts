/**
 * File: src/modules/users/users.routes.ts
 * Purpose: Register REST endpoints for user administration.
 * Why: Provides a stable routing layer that aligns with the layered architecture.
 */
import { Router } from "express";

import { getUser, getUsers, postUser } from "./users.controller.js";

export const userRouter = Router();

userRouter.get("/", getUsers);
userRouter.post("/", postUser);
userRouter.get("/:userId", getUser);
