/**
 * File: src/modules/users/users.controller.ts
 * Purpose: Translate HTTP requests into user service calls with scaffold responses.
 * Why: Maintains a clean separation between routing and user-related business logic.
 */
import { type Request, type Response } from "express";

import {
  createUser,
  getUserById,
  listUsers,
} from "./users.service.js";

export async function getUsers(_req: Request, res: Response): Promise<void> {
  await listUsers();
  res.status(501).json({ message: "User listing not implemented yet." });
}

export async function getUser(req: Request, res: Response): Promise<void> {
  await getUserById(req.params);
  res.status(501).json({ message: "User lookup not implemented yet." });
}

export async function postUser(req: Request, res: Response): Promise<void> {
  await createUser(req.body);
  res.status(501).json({ message: "User creation not implemented yet." });
}
