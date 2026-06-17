import type { NextFunction, Request, Response } from "express";
import { randomBytes } from "crypto";
import { supabaseAnon } from "./supabase";
import { storage } from "./storage";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      supabaseUser?: {
        id: string;
        email?: string;
      };
    }
  }
}

function parseBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function attachSupabaseUser(req: Request, _res: Response, next: NextFunction) {
  const token = parseBearerToken(req);
  if (!token) return next();

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) return next();

  req.supabaseUser = {
    id: data.user.id,
    email: data.user.email ?? undefined,
  };

  // Map Supabase user -> existing app user shape (numeric id)
  // We keep business logic intact by ensuring req.user exists where expected.
  const email = data.user.email ?? null;
  if (email) {
    const existing = await storage.getUserByUsername(email);
    if (existing) {
      (req as any).user = existing;
      return next();
    }
  }

  const usernameFallback = (email?.split("@")[0] || `user_${data.user.id.slice(0, 8)}`).toLowerCase();
  const created = await storage.createUser({
    username: usernameFallback,
    email: email ?? undefined,
    // Password is unused with Supabase Auth; keep placeholder to satisfy schema.
    password: randomBytes(16).toString("hex"),
    role: "viewer",
  } as any);

  (req as any).user = created;
  next();
}

export function requireSupabaseAuth(req: any, res: any, next: any) {
  if (req.user) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

