/**
 * File: src/modules/users/users.controller.ts
 * Purpose: Translate HTTP requests into user service calls with persisted responses.
 * Why: Maintains a clean separation between routing and user-related business logic.
 */
import { type Request, type Response } from "express";

import {
  approveTeacherRequest,
  createUser,
  getUserById,
  inviteUser,
  listUsers,
  rejectTeacherRequest,
} from "./users.service.js";

function requireActor(
  req: Request,
  res: Response,
): NonNullable<Request["user"]> | null {
  const actor = req.user;
  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return actor;
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const users = await listUsers(req.query);
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

export async function postUserInvite(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = requireActor(req, res);
  if (!actor) {
    return;
  }

  const user = await inviteUser(req.body, actor);
  res.status(201).json(user);
}

export async function postTeacherApproval(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = requireActor(req, res);
  if (!actor) {
    return;
  }

  const user = await approveTeacherRequest(req.params, actor);
  res.status(200).json(user);
}

export async function postTeacherRejection(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = requireActor(req, res);
  if (!actor) {
    return;
  }

  const user = await rejectTeacherRequest(req.params, actor);
  res.status(200).json(user);
}
