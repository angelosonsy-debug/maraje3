import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

function readBotSecret(): string {
  return process.env["BOT_API_SECRET"]?.trim() ?? "";
}

function tokenMatches(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

/**
 * Gate for the internal endpoints the Telegram bot (artifacts/telegram-bot)
 * calls — never exposed to the app or a browser. A separate scheme from
 * both `requireAdmin` (long-lived MARAJE3_ADMIN_TOKEN) and `requireUser`
 * (per-account session JWT) on purpose: the bot is neither an admin nor a
 * signed-in student, just a trusted internal caller.
 */
export function requireBotSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = readBotSecret();
  if (!expected) {
    res
      .status(503)
      .json({ error: "ربط بوت تليجرام غير مُفعّل على هذا السيرفر." });
    return;
  }
  const candidate = req.get("X-Bot-Secret") ?? "";
  if (!tokenMatches(candidate, expected)) {
    res.status(401).json({ error: "مفتاح البوت غير صحيح." });
    return;
  }
  next();
}
