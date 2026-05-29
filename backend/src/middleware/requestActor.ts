/**
 * File: src/middleware/requestActor.ts
 * Purpose: Resolve authenticated request actors from bearer tokens or dev/test headers.
 * Why: Keeps authGuard and rlsContext aligned on how request identity is parsed.
 */
import { type Request } from "express";
import { z } from "zod";

import { config } from "../config/env.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";
import { UserRole, UserStatus } from "../prisma/index.js";

export type RequestActor = {
  id: string;
  role: UserRole;
  status: UserStatus;
};

export type RequestActorResolution =
  | { kind: "authenticated"; actor: RequestActor }
  | { kind: "anonymous" }
  | { kind: "invalid" };

const tokenClaimsSchema = z.object({
  sub: z.string().min(1),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
});

const headerActorSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).default(UserStatus.active),
});

export function resolveRequestActor(req: Request): RequestActorResolution {
  const bearer = resolveBearerActor(req);
  if (bearer.kind !== "anonymous") {
    return bearer;
  }

  if (config.nodeEnv === "production") {
    return { kind: "anonymous" };
  }

  const headerActor = parseHeaderActor(req);
  return headerActor
    ? { kind: "authenticated", actor: headerActor }
    : { kind: "anonymous" };
}

export function isActiveActor(actor: RequestActor): boolean {
  return actor.status === UserStatus.active;
}

function resolveBearerActor(req: Request): RequestActorResolution {
  const authorizationHeader = req.header("authorization");
  if (!authorizationHeader) {
    return { kind: "anonymous" };
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return { kind: "invalid" };
  }

  try {
    const claims = tokenClaimsSchema.safeParse(verifyAccessToken(token));
    if (!claims.success) {
      return { kind: "invalid" };
    }

    return {
      kind: "authenticated",
      actor: {
        id: claims.data.sub,
        role: claims.data.role,
        status: claims.data.status,
      },
    };
  } catch {
    return { kind: "invalid" };
  }
}

function parseHeaderActor(req: Request): RequestActor | null {
  const parsed = headerActorSchema.safeParse({
    userId: req.header("x-user-id"),
    role: req.header("x-user-role"),
    status: req.header("x-user-status") ?? UserStatus.active,
  });

  if (!parsed.success) {
    return null;
  }

  return {
    id: parsed.data.userId,
    role: parsed.data.role,
    status: parsed.data.status,
  };
}
