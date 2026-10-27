import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

const SESSION_TOKEN_TTL = "30d";

function readGoogleClientIds(): string[] {
  return (process.env["GOOGLE_CLIENT_IDS"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function readSessionSecret(): string {
  return process.env["SESSION_SECRET"]?.trim() ?? "";
}

let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  googleClient ??= new OAuth2Client();
  return googleClient;
}

export type VerifiedGoogleIdentity = {
  googleSub: string;
  displayName: string;
  photoUrl: string | null;
};

export class GoogleSignInNotConfiguredError extends Error {}
export class GoogleTokenVerificationError extends Error {}

/**
 * Verifies a Google ID token against our allow-listed OAuth client IDs
 * (one per platform: Android, iOS, web — see GOOGLE_CLIENT_IDS).
 */
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<VerifiedGoogleIdentity> {
  const audiences = readGoogleClientIds();
  if (audiences.length === 0) {
    throw new GoogleSignInNotConfiguredError(
      "GOOGLE_CLIENT_IDS is not configured.",
    );
  }

  let ticket;
  try {
    ticket = await getGoogleClient().verifyIdToken({
      idToken,
      audience: audiences,
    });
  } catch {
    throw new GoogleTokenVerificationError("Invalid Google ID token.");
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email_verified) {
    throw new GoogleTokenVerificationError(
      "Google ID token payload is missing or the email is unverified.",
    );
  }

  return {
    googleSub: payload.sub,
    displayName: payload.name?.trim() || payload.email || "مستخدم مراجع",
    photoUrl: payload.picture ?? null,
  };
}

export class SessionNotConfiguredError extends Error {}

export function signSessionToken(userId: string): string {
  const secret = readSessionSecret();
  if (!secret) {
    throw new SessionNotConfiguredError("SESSION_SECRET is not configured.");
  }
  return jwt.sign({ sub: userId }, secret, { expiresIn: SESSION_TOKEN_TTL });
}

function verifySessionToken(token: string): string | null {
  const secret = readSessionSecret();
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret);
    if (
      decoded &&
      typeof decoded === "object" &&
      typeof decoded.sub === "string"
    ) {
      return decoded.sub;
    }
    return null;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Loads the signed-in contributor from a session bearer token.
 * Separate from the long-lived `MARAJE3_ADMIN_TOKEN` scheme used by
 * /catalog/admin/* — the two auth systems are intentionally not merged.
 */
/**
 * Loads `req.user` from a session bearer token when one is present and
 * valid, but never rejects the request — used for endpoints that work
 * both signed-in and anonymously (e.g. reporting), where being signed in
 * just lets us attribute the action to an account instead of a device id.
 */
export function attachUserIfPresent(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authorization = req.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    next();
    return;
  }

  const userId = verifySessionToken(token);
  if (!userId) {
    next();
    return;
  }

  db.select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then(([user]) => {
      req.user = user;
      next();
    })
    .catch((error: unknown) => {
      req.log.error({ err: error }, "Failed to optionally load session user");
      next();
    });
}

/**
 * Full account block (Stage 8 — Play's "ban violating users" requirement),
 * set by an admin via the report-resolution "suspend-account" action
 * (routes/reports.ts). Distinct from the Stage 4 `uploadSuspendedUntil`
 * timer, which only blocks uploads for N days — this blocks every
 * identity-bound creation endpoint outright until an admin reinstates the
 * account. Checked explicitly at the top of those route handlers rather
 * than inside requireUser itself, so a suspended user can still sign in,
 * read/update their own profile, and delete their own account.
 */
export function isAccountSuspended(user: { status: string }): boolean {
  return user.status === "suspended";
}

export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    res.status(401).json({ error: "تسجيل الدخول مطلوب." });
    return;
  }

  const userId = verifySessionToken(token);
  if (!userId) {
    res.status(401).json({ error: "جلسة الدخول غير صالحة أو منتهية." });
    return;
  }

  db.select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then(([user]) => {
      if (!user) {
        res.status(401).json({ error: "الحساب غير موجود." });
        return;
      }
      req.user = user;
      next();
    })
    .catch((error: unknown) => {
      req.log.error({ err: error }, "Failed to load session user");
      res.status(503).json({ error: "تعذر التحقق من جلسة الدخول حالياً." });
    });
}
