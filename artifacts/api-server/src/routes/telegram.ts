import {
  ConsumeTelegramLinkCodeBody,
  ConsumeTelegramLinkCodeResponse,
  CreateTelegramLinkCodeResponse,
} from "@workspace/api-zod";
import { db, telegramLinkCodesTable, usersTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { Router, type IRouter } from "express";
import { requireBotSecret } from "../lib/bot-auth";
import { requireUser } from "../lib/auth";

const router: IRouter = Router();

const LINK_CODE_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
  // 6 digits, easy to type into Telegram as "/ربط 123456".
  return String(randomInt(100000, 1000000));
}

router.post(
  "/telegram/link-code",
  requireUser,
  async (req, res): Promise<void> => {
    try {
      const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
      let code = generateCode();
      // Extremely unlikely collision (1 in ~900k live codes), but retry
      // once rather than risk a unique-index insert failure.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const [existing] = await db
          .select({ id: telegramLinkCodesTable.id })
          .from(telegramLinkCodesTable)
          .where(eq(telegramLinkCodesTable.code, code))
          .limit(1);
        if (!existing) break;
        code = generateCode();
      }

      await db.insert(telegramLinkCodesTable).values({
        code,
        userId: req.user!.id,
        expiresAt,
      });

      res.json(CreateTelegramLinkCodeResponse.parse({ code, expiresAt }));
    } catch (error) {
      req.log.error({ err: error }, "Generating a Telegram link code failed");
      res.status(503).json({ error: "تعذر إنشاء كود الربط حالياً." });
    }
  },
);

router.post(
  "/internal/telegram/link",
  requireBotSecret,
  async (req, res): Promise<void> => {
    const parsed = ConsumeTelegramLinkCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات الربط غير صالحة." });
      return;
    }
    const { code, telegramUserId, telegramChatId } = parsed.data;

    try {
      const [link] = await db
        .select()
        .from(telegramLinkCodesTable)
        .where(
          and(
            eq(telegramLinkCodesTable.code, code),
            eq(telegramLinkCodesTable.consumed, false),
            gt(telegramLinkCodesTable.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!link) {
        res.status(400).json({ error: "الكود غير صحيح أو منتهي الصلاحية." });
        return;
      }

      const [takenBy] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.telegramUserId, telegramUserId))
        .limit(1);
      if (takenBy && takenBy.id !== link.userId) {
        res.status(400).json({
          error: "حساب تليجرام هذا مرتبط بحساب آخر بالفعل.",
        });
        return;
      }

      await db
        .update(telegramLinkCodesTable)
        .set({ consumed: true })
        .where(eq(telegramLinkCodesTable.id, link.id));

      const [updated] = await db
        .update(usersTable)
        .set({ telegramUserId, telegramChatId })
        .where(eq(usersTable.id, link.userId))
        .returning({ displayName: usersTable.displayName });
      if (!updated) {
        res.status(400).json({ error: "الحساب المرتبط لم يعد موجوداً." });
        return;
      }

      res.json(
        ConsumeTelegramLinkCodeResponse.parse({
          success: true,
          displayName: updated.displayName,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Consuming a Telegram link code failed");
      res.status(503).json({ error: "تعذر إتمام الربط حالياً." });
    }
  },
);

export default router;
