import { Bot, InlineKeyboard, type Context } from "grammy";
import {
  fetchCatalogTree,
  linkTelegramAccount,
  MaraApiError,
  submitFile,
  type CatalogTree,
} from "./api";
import { readBotToken } from "./config";
import {
  CATEGORY_OPTIONS,
  clearFlow,
  getFlow,
  startFlow,
  updateFlow,
  type FlowState,
} from "./sessions";

const bot = new Bot(readBotToken());

// Refetched on demand (not cached across the process lifetime) since the
// catalog can change — this bot has low enough traffic that a request per
// flow step is not a concern. Worth revisiting with a short TTL cache if
// usage grows.
async function loadCatalog(): Promise<CatalogTree> {
  return fetchCatalogTree();
}

function truncateLabel(label: string, max = 40): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function keyboardFor(
  options: Array<{ id: number; label: string }>,
  prefix: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  options.forEach((option, index) => {
    keyboard.text(truncateLabel(option.label), `${prefix}:${option.id}`);
    if (index % 2 === 1) keyboard.row();
  });
  return keyboard;
}

async function sendFacultyStep(ctx: Context, chatId: number): Promise<void> {
  const catalog = await loadCatalog();
  const keyboard = keyboardFor(
    catalog.faculties.map((f) => ({ id: f.id, label: f.nameAr })),
    "f",
  );
  await ctx.reply("اختر الكلية:", { reply_markup: keyboard });
}

async function sendAcademicYearStep(
  ctx: Context,
  catalog: CatalogTree,
  facultyId: number,
): Promise<void> {
  const years = catalog.academicYears.filter((y) => y.facultyId === facultyId);
  const keyboard = keyboardFor(
    years.map((y) => ({ id: y.id, label: y.labelAr })),
    "y",
  );
  await ctx.reply("اختر الفرقة الدراسية:", { reply_markup: keyboard });
}

async function sendSemesterStep(
  ctx: Context,
  catalog: CatalogTree,
  academicYearId: number,
): Promise<void> {
  const semesters = catalog.semesters.filter((s) => s.academicYearId === academicYearId);
  const keyboard = keyboardFor(
    semesters.map((s) => ({ id: s.id, label: s.labelAr })),
    "s",
  );
  await ctx.reply("اختر الترم:", { reply_markup: keyboard });
}

async function sendSubjectStep(
  ctx: Context,
  catalog: CatalogTree,
  semesterId: number,
): Promise<void> {
  const subjects = catalog.subjects.filter((s) => s.semesterId === semesterId);
  const keyboard = keyboardFor(
    subjects.map((s) => ({ id: s.id, label: s.nameAr })),
    "sub",
  );
  await ctx.reply("اختر المادة:", { reply_markup: keyboard });
}

async function sendCategoryStep(ctx: Context): Promise<void> {
  const keyboard = new InlineKeyboard();
  CATEGORY_OPTIONS.forEach((option, index) => {
    keyboard.text(option.labelAr, `c:${option.value}`);
    if (index % 2 === 1) keyboard.row();
  });
  await ctx.reply("نوع الملف؟", { reply_markup: keyboard });
}

async function startIntakeFlow(
  ctx: Context,
  file: { fileId: string; contentType: string },
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  startFlow(chatId, file);
  await ctx.reply("استلمنا الملف. هنحتاج نعرف تفاصيله عشان يتراجع وينشر 👇");
  await sendFacultyStep(ctx, chatId);
}

bot.on("message:document", async (ctx) => {
  const doc = ctx.message.document;
  await startIntakeFlow(ctx, {
    fileId: doc.file_id,
    contentType: doc.mime_type ?? "application/octet-stream",
  });
});

bot.on("message:photo", async (ctx) => {
  const sizes = ctx.message.photo;
  const largest = sizes[sizes.length - 1];
  if (!largest) return;
  await startIntakeFlow(ctx, { fileId: largest.file_id, contentType: "image/jpeg" });
});

// "/ربط <code>" — Telegram's bot_command entity only recognizes ASCII
// commands, so a literal Arabic "/ربط" never arrives as a parsed command;
// it must be matched as plain text instead of using bot.command().
bot.hears(/^\/?ربط\s+(\d+)/, async (ctx) => {
  const match = ctx.match as RegExpMatchArray;
  const code = match[1];
  if (!code) return;
  const from = ctx.from;
  if (!from || !ctx.chat) return;

  try {
    const result = await linkTelegramAccount({
      code,
      telegramUserId: String(from.id),
      telegramChatId: String(ctx.chat.id),
      telegramUsername: from.username ?? null,
    });
    await ctx.reply(`تم الربط بنجاح ✅ أهلاً بيك يا ${result.displayName}`);
  } catch (error) {
    if (error instanceof MaraApiError) {
      await ctx.reply(`تعذر الربط: ${error.message}`);
      return;
    }
    await ctx.reply("حصل خطأ أثناء محاولة الربط، حاول تاني.");
  }
});

bot.on("callback_query:data", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const data = ctx.callbackQuery.data;
  const flow = getFlow(chatId);
  if (!flow) {
    await ctx.answerCallbackQuery();
    return;
  }

  const [kind, rawValue] = data.split(":");
  await ctx.answerCallbackQuery();

  try {
    const catalog = await loadCatalog();

    if (kind === "f" && flow.step === "faculty") {
      const facultyId = Number(rawValue);
      updateFlow(chatId, { step: "academicYear", facultyId });
      await sendAcademicYearStep(ctx, catalog, facultyId);
      return;
    }

    if (kind === "y" && flow.step === "academicYear") {
      const academicYearId = Number(rawValue);
      updateFlow(chatId, { step: "semester", academicYearId });
      await sendSemesterStep(ctx, catalog, academicYearId);
      return;
    }

    if (kind === "s" && flow.step === "semester") {
      const semesterId = Number(rawValue);
      updateFlow(chatId, { step: "subject", semesterId });
      await sendSubjectStep(ctx, catalog, semesterId);
      return;
    }

    if (kind === "sub" && flow.step === "subject") {
      const subjectId = Number(rawValue);
      const subject = catalog.subjects.find((s) => s.id === subjectId);
      updateFlow(chatId, {
        step: "category",
        subjectId,
        subjectLabel: subject?.nameAr ?? "",
      });
      await sendCategoryStep(ctx);
      return;
    }

    if (kind === "c" && flow.step === "category") {
      await finishFlow(ctx, chatId, { ...flow, step: "category" }, rawValue as string);
      return;
    }
  } catch (error) {
    if (error instanceof MaraApiError) {
      await ctx.reply(`حصل خطأ: ${error.message}`);
    } else {
      await ctx.reply("حصل خطأ غير متوقع، ابعت الملف تاني.");
    }
    clearFlow(chatId);
  }
});

async function finishFlow(
  ctx: Context,
  chatId: number,
  flow: FlowState,
  category: string,
): Promise<void> {
  if (!flow.subjectId) {
    await ctx.reply("حصل خطأ، ابعت الملف تاني من الأول.");
    clearFlow(chatId);
    return;
  }

  const from = ctx.from;
  const fileLink = await ctx.api.getFile(flow.file.fileId);
  if (!fileLink.file_path) {
    await ctx.reply("تعذر تحميل الملف من تليجرام، حاول تبعته تاني.");
    clearFlow(chatId);
    return;
  }

  const downloadUrl = `https://api.telegram.org/file/bot${readBotToken()}/${fileLink.file_path}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    await ctx.reply("تعذر تحميل الملف من تليجرام، حاول تبعته تاني.");
    clearFlow(chatId);
    return;
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  try {
    await submitFile({
      bytes,
      contentType: flow.file.contentType,
      subjectId: flow.subjectId,
      titleAr: flow.subjectLabel || "ملف بدون عنوان",
      category: category as (typeof CATEGORY_OPTIONS)[number]["value"],
      telegramUserId: String(from?.id ?? ""),
      telegramUsername: from?.username ?? null,
    });
    await ctx.reply("وصلنا ملفك وهيتراجع قريبًا ✅");
  } catch (error) {
    if (error instanceof MaraApiError) {
      await ctx.reply(`تعذر حفظ الملف: ${error.message}`);
    } else {
      await ctx.reply("حصل خطأ أثناء حفظ الملف، حاول تاني.");
    }
  } finally {
    clearFlow(chatId);
  }
}

bot.catch((err) => {
  console.error("Unhandled bot error:", err);
});

bot
  .start()
  .then(() => {
    console.log("مراجعي Telegram bot started (long polling).");
  })
  .catch((error) => {
    console.error("Failed to start the Telegram bot:", error);
    process.exitCode = 1;
  });
