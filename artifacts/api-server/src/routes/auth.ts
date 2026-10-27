import {
  DeleteCurrentUserResponse,
  GetCurrentUserResponse,
  RefreshSessionResponse,
  SignInWithGoogleBody,
  SignInWithGoogleResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
} from "@workspace/api-zod";
import { db, facultiesTable, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { adminAuthFailureLimiter } from "../middlewares/rate-limit";
import {
  GoogleSignInNotConfiguredError,
  GoogleTokenVerificationError,
  SessionNotConfiguredError,
  requireUser,
  signSessionToken,
  verifyGoogleIdToken,
} from "../lib/auth";

const router: IRouter = Router();

export function toUserProfile(user: User) {
  return {
    id: user.id,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    facultyId: user.facultyId,
    role: user.role,
    status: user.status,
    hideIdentity: user.hideIdentity,
    premiumGranted: user.premiumGranted,
    premiumPurchased: user.premiumPurchased,
    isPremium: user.premiumGranted || user.premiumPurchased,
    createdAt: user.createdAt,
  };
}

// Reuse the admin endpoint's brute-force limiter shape for sign-in attempts;
// it only counts non-2xx responses, so normal usage is unaffected.
router.use("/auth/google", adminAuthFailureLimiter);

router.post("/auth/google", async (req, res): Promise<void> => {
  const parsed = SignInWithGoogleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات تسجيل الدخول غير صالحة." });
    return;
  }

  try {
    const identity = await verifyGoogleIdToken(parsed.data.idToken);

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleSub, identity.googleSub))
      .limit(1);

    const [user] = existing
      ? await db
          .update(usersTable)
          .set({
            displayName: identity.displayName,
            photoUrl: identity.photoUrl,
          })
          .where(eq(usersTable.id, existing.id))
          .returning()
      : await db
          .insert(usersTable)
          .values({
            googleSub: identity.googleSub,
            displayName: identity.displayName,
            photoUrl: identity.photoUrl,
          })
          .returning();

    if (!user) {
      res.status(503).json({ error: "تعذر إنشاء الحساب حالياً." });
      return;
    }

    const token = signSessionToken(user.id);
    res.json(
      SignInWithGoogleResponse.parse({ token, user: toUserProfile(user) }),
    );
  } catch (error) {
    if (
      error instanceof GoogleSignInNotConfiguredError ||
      error instanceof SessionNotConfiguredError
    ) {
      res.status(503).json({ error: "تسجيل الدخول بجوجل غير مفعّل حالياً." });
      return;
    }
    if (error instanceof GoogleTokenVerificationError) {
      res.status(401).json({ error: "تعذر التحقق من حساب جوجل." });
      return;
    }
    req.log.error({ err: error }, "Google sign-in failed");
    res.status(503).json({ error: "تعذر تسجيل الدخول حالياً." });
  }
});

router.get("/auth/me", requireUser, (req, res): void => {
  res.json(GetCurrentUserResponse.parse(toUserProfile(req.user!)));
});

router.patch("/auth/me", requireUser, async (req, res): Promise<void> => {
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "أدخل تغييراً واحداً على الأقل." });
    return;
  }

  try {
    const values: { hideIdentity?: boolean; facultyId?: number | null } = {};
    if (parsed.data.hideIdentity !== undefined) {
      values.hideIdentity = parsed.data.hideIdentity;
    }
    if (parsed.data.facultyId !== undefined) {
      if (parsed.data.facultyId !== null) {
        const [faculty] = await db
          .select({ id: facultiesTable.id })
          .from(facultiesTable)
          .where(eq(facultiesTable.id, parsed.data.facultyId))
          .limit(1);
        if (!faculty) {
          res.status(400).json({ error: "الكلية غير موجودة." });
          return;
        }
      }
      values.facultyId = parsed.data.facultyId;
    }

    const [updated] = await db
      .update(usersTable)
      .set(values)
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    if (!updated) {
      res.status(401).json({ error: "الحساب غير موجود." });
      return;
    }
    res.json(UpdateCurrentUserResponse.parse(toUserProfile(updated)));
  } catch (error) {
    req.log.error({ err: error }, "Profile update failed");
    res.status(503).json({ error: "تعذر حفظ التغييرات حالياً." });
  }
});

router.delete("/auth/me", requireUser, async (req, res): Promise<void> => {
  try {
    // materials.uploaderId references users with ON DELETE SET NULL, so a
    // contributor's published materials survive with their attribution
    // removed automatically — matching the "unlink identity" requirement.
    await db.delete(usersTable).where(eq(usersTable.id, req.user!.id));
    res.json(DeleteCurrentUserResponse.parse({ success: true }));
  } catch (error) {
    req.log.error({ err: error }, "Account deletion failed");
    res.status(503).json({ error: "تعذر حذف الحساب حالياً." });
  }
});

router.post("/auth/refresh", requireUser, (req, res): void => {
  try {
    const token = signSessionToken(req.user!.id);
    res.json(RefreshSessionResponse.parse({ token }));
  } catch (error) {
    if (error instanceof SessionNotConfiguredError) {
      res.status(503).json({ error: "تسجيل الدخول غير مفعّل حالياً." });
      return;
    }
    req.log.error({ err: error }, "Session refresh failed");
    res.status(503).json({ error: "تعذر تجديد الجلسة حالياً." });
  }
});

export default router;
