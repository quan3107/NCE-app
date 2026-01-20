/**
 * File: src/modules/users/users.controller.ts
 * Purpose: Translate HTTP requests into user service calls with persisted responses.
 * Why: Maintains a clean separation between routing and user-related business logic.
 */
import { type Request, type Response } from "express";

import {
  createUser,
  getUserById,
  listUsers,
} from "./users.service.js";

export async function getUsers(_req: Request, res: Response): Promise<void> {
  const users = await listUsers();
  res.status(200).json(users);
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const user = await getUserById(req.params);
  res.status(200).json(user);
}

export async function postUser(req: Request, res: Response): Promise<void> {
  const user = await createUser(req.body);
  res.status(201).json(user);
}
