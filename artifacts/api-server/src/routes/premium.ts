import { VerifyPremiumPurchaseBody, VerifyPremiumPurchaseResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GooglePlayNotConfiguredError,
  GooglePlayVerificationError,
  verifyAndAcknowledgePurchase,
} from "../lib/google-play";
import { requireUser } from "../lib/auth";
import { toUserProfile } from "./auth";

const router: IRouter = Router();

router.post(
  "/premium/verify-purchase",
  requireUser,
  async (req, res): Promise<void> => {
    const parsed = VerifyPremiumPurchaseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات عملية الشراء غير صالحة." });
      return;
    }

    try {
      await verifyAndAcknowledgePurchase({
        productId: parsed.data.productId,
        purchaseToken: parsed.data.purchaseToken,
      });
    } catch (error) {
      if (error instanceof GooglePlayNotConfiguredError) {
        res.status(503).json({ error: "التحقق من المشتريات غير مُفعّل حالياً." });
        return;
      }
      if (error instanceof GooglePlayVerificationError) {
        res.status(400).json({ error: "تعذر التحقق من عملية الشراء." });
        return;
      }
      req.log.error({ err: error }, "Google Play purchase verification failed");
      res.status(503).json({ error: "تعذر التحقق من عملية الشراء حالياً." });
      return;
    }

    try {
      const [updated] = await db
        .update(usersTable)
        .set({
          premiumPurchased: true,
          premiumPurchaseToken: parsed.data.purchaseToken,
          premiumProductId: parsed.data.productId,
        })
        .where(eq(usersTable.id, req.user!.id))
        .returning();
      if (!updated) {
        res.status(401).json({ error: "الحساب غير موجود." });
        return;
      }

      res.json(
        VerifyPremiumPurchaseResponse.parse({
          success: true,
          user: toUserProfile(updated),
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Storing Premium entitlement failed");
      res.status(503).json({ error: "تم التحقق من الشراء لكن تعذر حفظه حالياً." });
    }
  },
);

export default router;
