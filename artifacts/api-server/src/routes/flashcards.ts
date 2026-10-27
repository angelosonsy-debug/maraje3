import {
  CreateAdminFlashcardDeckBody,
  CreateAdminFlashcardDeckResponse,
  GetAdminFlashcardDeckResponse,
  GetAdminFlashcardDecksResponse,
  GetFlashcardDeckResponse,
  GetFlashcardDecksQueryParams,
  GetFlashcardDecksResponse,
  ManageAdminFlashcardDeckBody,
  ManageAdminFlashcardDeckResponse,
  SuggestFlashcardDeckBody,
  SuggestFlashcardDeckResponse,
} from "@workspace/api-zod";
import {
  db,
  flashcardDecksTable,
  flashcardsTable,
  subjectsTable,
} from "@workspace/db";
import { count, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAdmin } from "./catalog";
import { isAccountSuspended, requireUser } from "../lib/auth";

const router: IRouter = Router();

async function loadDeckWithCards(deckId: number) {
  const [deck] = await db
    .select()
    .from(flashcardDecksTable)
    .where(eq(flashcardDecksTable.id, deckId))
    .limit(1);
  if (!deck) return null;
  const cards = await db
    .select()
    .from(flashcardsTable)
    .where(eq(flashcardsTable.deckId, deckId))
    .orderBy(flashcardsTable.position, flashcardsTable.id);
  return { deck, cards };
}

function toDeckDetail(
  deck: typeof flashcardDecksTable.$inferSelect,
  cards: Array<typeof flashcardsTable.$inferSelect>,
) {
  return {
    id: deck.id,
    subjectId: deck.subjectId,
    titleAr: deck.titleAr,
    status: deck.status,
    cards: cards.map((card) => ({
      id: card.id,
      deckId: card.deckId,
      questionAr: card.questionAr,
      answerAr: card.answerAr,
      options: card.options ?? null,
      explanationAr: card.explanationAr ?? null,
      position: card.position,
    })),
  };
}

async function insertDeckWithCards(params: {
  subjectId: number;
  titleAr: string;
  status: "pending" | "published";
  createdByUserId: string | null;
  cards: Array<{
    questionAr: string;
    answerAr: string;
    options?: string[] | null;
    explanationAr?: string | null;
  }>;
}) {
  const [deck] = await db
    .insert(flashcardDecksTable)
    .values({
      subjectId: params.subjectId,
      titleAr: params.titleAr,
      status: params.status,
      createdByUserId: params.createdByUserId,
    })
    .returning();
  if (!deck) return null;

  if (params.cards.length > 0) {
    await db.insert(flashcardsTable).values(
      params.cards.map((card, index) => ({
        deckId: deck.id,
        questionAr: card.questionAr.trim(),
        answerAr: card.answerAr.trim(),
        options: card.options ?? null,
        explanationAr: card.explanationAr ?? null,
        position: index,
      })),
    );
  }

  return deck;
}

// Public — browsing never requires login.
router.get("/flashcards/decks", async (req, res): Promise<void> => {
  const parsed = GetFlashcardDecksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "معرّف المادة غير صالح." });
    return;
  }

  try {
    const decks = await db
      .select()
      .from(flashcardDecksTable)
      .where(eq(flashcardDecksTable.subjectId, parsed.data.subjectId));
    const published = decks.filter((deck) => deck.status === "published");

    let cardCounts = new Map<number, number>();
    if (published.length > 0) {
      const rows = await db
        .select({ deckId: flashcardsTable.deckId, value: count() })
        .from(flashcardsTable)
        .where(
          inArray(
            flashcardsTable.deckId,
            published.map((deck) => deck.id),
          ),
        )
        .groupBy(flashcardsTable.deckId);
      cardCounts = new Map(rows.map((row) => [row.deckId, row.value]));
    }

    res.json(
      GetFlashcardDecksResponse.parse({
        decks: published.map((deck) => ({
          id: deck.id,
          subjectId: deck.subjectId,
          titleAr: deck.titleAr,
          cardCount: cardCounts.get(deck.id) ?? 0,
        })),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Listing flashcard decks failed");
    res.status(503).json({ error: "تعذر تحميل بطاقات المراجعة حالياً." });
  }
});

router.post(
  "/flashcards/decks",
  requireUser,
  async (req, res): Promise<void> => {
    const parsed = SuggestFlashcardDeckBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات المجموعة غير صالحة." });
      return;
    }
    const body = parsed.data;

    if (isAccountSuspended(req.user!)) {
      res.status(403).json({ error: "تم حظر حسابك من قِبل فريق الإدارة." });
      return;
    }

    try {
      const [subject] = await db
        .select({ id: subjectsTable.id })
        .from(subjectsTable)
        .where(eq(subjectsTable.id, body.subjectId))
        .limit(1);
      if (!subject) {
        res.status(400).json({ error: "المادة الدراسية غير موجودة." });
        return;
      }

      const deck = await insertDeckWithCards({
        subjectId: body.subjectId,
        titleAr: body.titleAr.trim(),
        status: "pending",
        createdByUserId: req.user!.id,
        cards: body.cards,
      });
      if (!deck) {
        res.status(503).json({ error: "تعذر إنشاء المجموعة حالياً." });
        return;
      }

      res.json(
        SuggestFlashcardDeckResponse.parse({ id: deck.id, status: deck.status }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Suggesting a flashcard deck failed");
      res.status(503).json({ error: "تعذر إنشاء المجموعة حالياً." });
    }
  },
);

router.get("/flashcards/decks/:id", async (req, res): Promise<void> => {
  const id = Number.parseInt(String(req.params["id"] ?? ""), 10);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "المجموعة غير موجودة." });
    return;
  }

  try {
    const loaded = await loadDeckWithCards(id);
    if (!loaded || loaded.deck.status !== "published") {
      res.status(404).json({ error: "المجموعة غير موجودة." });
      return;
    }
    res.json(
      GetFlashcardDeckResponse.parse(toDeckDetail(loaded.deck, loaded.cards)),
    );
  } catch (error) {
    req.log.error({ err: error }, "Loading a flashcard deck failed");
    res.status(503).json({ error: "تعذر تحميل المجموعة حالياً." });
  }
});

router.get(
  "/catalog/admin/flashcards",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const decks = await db.select().from(flashcardDecksTable);
      const rows = await db
        .select({ deckId: flashcardsTable.deckId, value: count() })
        .from(flashcardsTable)
        .groupBy(flashcardsTable.deckId);
      const cardCounts = new Map(rows.map((row) => [row.deckId, row.value]));

      res.json(
        GetAdminFlashcardDecksResponse.parse({
          decks: decks.map((deck) => ({
            id: deck.id,
            subjectId: deck.subjectId,
            titleAr: deck.titleAr,
            status: deck.status,
            cardCount: cardCounts.get(deck.id) ?? 0,
            createdByUserId: deck.createdByUserId,
            createdAt: deck.createdAt,
          })),
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Listing admin flashcard decks failed");
      res.status(503).json({ error: "تعذر تحميل المجموعات حالياً." });
    }
  },
);

router.post(
  "/catalog/admin/flashcards",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateAdminFlashcardDeckBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات المجموعة غير صالحة." });
      return;
    }
    const body = parsed.data;

    try {
      const [subject] = await db
        .select({ id: subjectsTable.id })
        .from(subjectsTable)
        .where(eq(subjectsTable.id, body.subjectId))
        .limit(1);
      if (!subject) {
        res.status(400).json({ error: "المادة الدراسية غير موجودة." });
        return;
      }

      // An admin directly building/pasting a deck is the review step itself
      // (same reasoning as the Stage 6 bulk-upload tool) — published right
      // away, no separate pending state.
      const deck = await insertDeckWithCards({
        subjectId: body.subjectId,
        titleAr: body.titleAr.trim(),
        status: "published",
        createdByUserId: null,
        cards: body.cards,
      });
      if (!deck) {
        res.status(503).json({ error: "تعذر إنشاء المجموعة حالياً." });
        return;
      }

      res.json(
        CreateAdminFlashcardDeckResponse.parse({
          id: deck.id,
          status: deck.status,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Admin flashcard deck creation failed");
      res.status(503).json({ error: "تعذر إنشاء المجموعة حالياً." });
    }
  },
);

router.get(
  "/catalog/admin/flashcards/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = Number.parseInt(String(req.params["id"] ?? ""), 10);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: "المجموعة غير موجودة." });
      return;
    }

    try {
      const loaded = await loadDeckWithCards(id);
      if (!loaded) {
        res.status(404).json({ error: "المجموعة غير موجودة." });
        return;
      }
      res.json(
        GetAdminFlashcardDeckResponse.parse(
          toDeckDetail(loaded.deck, loaded.cards),
        ),
      );
    } catch (error) {
      req.log.error({ err: error }, "Loading an admin flashcard deck failed");
      res.status(503).json({ error: "تعذر تحميل المجموعة حالياً." });
    }
  },
);

router.post(
  "/catalog/admin/flashcards/:id/manage",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = Number.parseInt(String(req.params["id"] ?? ""), 10);
    const bodyParsed = ManageAdminFlashcardDeckBody.safeParse(req.body);
    if (!Number.isInteger(id) || !bodyParsed.success) {
      res.status(400).json({ error: "بيانات غير صالحة." });
      return;
    }

    try {
      if (bodyParsed.data.action === "delete") {
        const [deleted] = await db
          .delete(flashcardDecksTable)
          .where(eq(flashcardDecksTable.id, id))
          .returning({ id: flashcardDecksTable.id });
        if (!deleted) {
          res.status(404).json({ error: "المجموعة غير موجودة." });
          return;
        }
        res.json(
          ManageAdminFlashcardDeckResponse.parse({
            success: true,
            status: null,
          }),
        );
        return;
      }

      const nextStatus =
        bodyParsed.data.action === "publish" ? "published" : "rejected";
      const [updated] = await db
        .update(flashcardDecksTable)
        .set({ status: nextStatus })
        .where(eq(flashcardDecksTable.id, id))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "المجموعة غير موجودة." });
        return;
      }
      res.json(
        ManageAdminFlashcardDeckResponse.parse({
          success: true,
          status: updated.status,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Managing a flashcard deck failed");
      res.status(503).json({ error: "تعذر تنفيذ الإجراء حالياً." });
    }
  },
);

export default router;
