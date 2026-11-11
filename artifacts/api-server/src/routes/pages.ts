import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Stage 8 — Google Play policy compliance. These are static, server-rendered
// (no DB reads needed) bilingual (Arabic + English) pages, outside /api on
// purpose (see app.ts: literal links a human or Play Console reviewer opens
// directly, e.g. https://<domain>/privacy, not API calls). Content below is
// kept in sync with what the app/server actually do — not a generic
// boilerplate policy — per rule 9(د): never claim data practices the code
// doesn't implement.

function readContactEmail(): string | null {
  return process.env["PUBLIC_CONTACT_EMAIL"]?.trim() || null;
}

function readAppName(): string {
  return "مراجعي | Maraje3";
}

function pageShell(params: {
  titleAr: string;
  titleEn: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${params.titleAr} / ${params.titleEn} — ${readAppName()}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; background: #f6f4ec; color: #123f4a; margin: 0; padding: 0 0 60px; line-height: 1.75; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 32px 20px; }
  header.page { text-align: center; margin-bottom: 28px; }
  header.page h1 { font-size: 22px; margin: 0 0 4px; }
  header.page p { color: #5a6b70; font-size: 13px; margin: 0; }
  section { background: #fff; border-radius: 16px; padding: 22px 24px; margin-bottom: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
  section[lang="ar"] { direction: rtl; text-align: right; }
  section[lang="en"] { direction: ltr; text-align: left; }
  h2 { font-size: 17px; margin: 0 0 12px; }
  h3 { font-size: 14px; margin: 18px 0 6px; }
  p, li { font-size: 13.5px; color: #2c3e42; }
  ul { padding-inline-start: 20px; margin: 6px 0; }
  .lang-divider { text-align: center; color: #a9b4b6; font-size: 11px; margin: 4px 0 18px; letter-spacing: 2px; }
  a { color: #123f4a; }
  .back { display: inline-block; margin-top: 10px; font-size: 12px; color: #5a6b70; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="page">
      <h1>${params.titleAr} <span style="color:#a9b4b6">/</span> ${params.titleEn}</h1>
      <p>${readAppName()}</p>
    </header>
    ${params.bodyHtml}
  </div>
</body>
</html>`;
}

router.get("/privacy", (_req, res): void => {
  const contactEmail = readContactEmail();
  res.type("html").send(
    pageShell({
      titleAr: "سياسة الخصوصية",
      titleEn: "Privacy Policy",
      bodyHtml: `
      <section lang="ar">
        <h2>سياسة الخصوصية</h2>
        <p>آخر تحديث: تُحدَّث هذه الصفحة يدوياً عند أي تغيير جوهري في طريقة تعامل التطبيق مع البيانات.</p>

        <h3>البيانات التي نجمعها</h3>
        <ul>
          <li><strong>حساب جوجل (اختياري):</strong> عند تسجيل الدخول لرفع ملف أو طلب ملف أو المساهمة، نحصل من جوجل على اسمك وصورتك الشخصية فقط — لا نطّلع على كلمة المرور أو بريدك بالكامل من التطبيق.</li>
          <li><strong>معرّف جهاز مجهول (Device ID):</strong> معرّف عشوائي يُنشئه التطبيق ويُخزَّن على جهازك فقط (وليس مشتقاً من أي معرّف فعلي لجهازك). يُستخدم لمنع تكرار البلاغات، ولمنع احتساب نفس التنزيل أكثر من مرة في نفس اليوم لنفس الملف — يُرسَل حتى لو كنت مسجّل الدخول.</li>
          <li><strong>الملفات المرفوعة:</strong> أي ملف ترفعه كمساهم (اسمه، نوعه، حجمه، ومحتواه) يُخزَّن على خوادم التخزين السحابي الخاصة بالتطبيق.</li>
          <li><strong>بيانات الاستخدام:</strong> على الخادم، نسجّل عدد مرات تنزيل كل ملف (مرتبطاً بمعرّف الجهاز، وبحسابك إن كنت مسجّلاً، لمنع الاحتساب المكرر ولحساب لوحة الصدارة)، والشكر الذي يحصل عليه كل ملف، وحالة البلاغات — لا نتتبع تصفحك خارج هذه الإحصاءات. تقدّم بطاقات المراجعة (Flashcards) والعدّاد اليومي للتنزيلات المجانية يُحفظان محلياً على جهازك فقط (AsyncStorage) ولا يُرسلان لنا.</li>
        </ul>

        <h3>الإعلانات</h3>
        <p>يستخدم التطبيق إعلانات Google AdMob (بانر وإعلانات مكافأة فقط، بدون إعلانات بينية). قد تعرض AdMob إعلانات مخصصة حسب موافقتك على نموذج الموافقة (UMP) الذي يظهر عند أول تشغيل في المناطق التي يتطلبها القانون المحلي. مستخدمو Premium (شراء لمرة واحدة) لا تظهر لهم إعلانات إطلاقاً.</p>

        <h3>مشاركة بياناتك علناً</h3>
        <p>اسمك وصورتك الشخصية يظهران بجانب الملفات التي ترفعها وفي لوحة الصدارة وبروفايلك العام كمساهم، <strong>إلا</strong> إذا فعّلت خيار "إخفاء هويتي" من صفحة حسابي — عندها تظهر ملفاتك بدون اسم أو صورة.</p>

        <h3>التخزين</h3>
        <p>تُخزَّن بيانات الحساب في قاعدة بيانات الخادم، والملفات في خدمة تخزين سحابي (Cloudflare R2 أو ما يعادلها). لا نبيع بياناتك لأي طرف ثالث، ولا نشاركها إلا مع مزوّدي الخدمة الضروريين لتشغيل التطبيق (التخزين، الإعلانات، التحقق من تسجيل الدخول والشراء).</p>

        <h3>حقوقك</h3>
        <p>يمكنك حذف حسابك بالكامل في أي وقت من داخل التطبيق (صفحة "حسابي" ← "حذف حسابي")، أو عبر <a href="/delete-account">صفحة حذف الحساب</a> على الويب. عند الحذف، يُفك ربط اسمك عن أي ملفات رفعتها (تبقى الملفات المنشورة متاحة بدون اسمك)، ويُحذف حسابك نهائياً.</p>

        ${contactEmail ? `<h3>تواصل معنا</h3><p>لأي استفسار عن الخصوصية: <a href="mailto:${contactEmail}">${contactEmail}</a></p>` : ""}
      </section>
      <div class="lang-divider">— ENGLISH —</div>
      <section lang="en">
        <h2>Privacy Policy</h2>
        <h3>Data we collect</h3>
        <ul>
          <li><strong>Google account (optional):</strong> signing in to upload, request, or contribute gives us only your name and profile photo from Google — nothing else.</li>
          <li><strong>Anonymous device ID:</strong> a random id the app generates and stores on your device only (not derived from any real device identifier). Used to rate-limit repeat reports and to avoid double-counting the same download on the same day for the same file — sent even when you're signed in.</li>
          <li><strong>Uploaded files:</strong> any file a contributor uploads (name, type, size, content) is stored on our cloud storage.</li>
          <li><strong>Usage data:</strong> on our server we record each file's download events (tied to the device id, and to your account if signed in, to prevent double-counting and to compute the leaderboard), "thanks" received, and report status. Flashcard review progress and the daily free-download counter are stored locally on your device only (AsyncStorage) and are never sent to us.</li>
        </ul>
        <h3>Advertising</h3>
        <p>The app uses Google AdMob (banner and rewarded ads only — no interstitials). AdMob may show personalized ads depending on the consent you give via the UMP consent form shown on first launch where required by local law. Premium (one-time purchase) users never see ads.</p>
        <h3>Public sharing of your data</h3>
        <p>Your name and photo appear next to materials you upload, on the leaderboard, and on your public contributor profile, <strong>unless</strong> you enable "Hide my identity" in your account settings — your uploads then show no name or photo.</p>
        <h3>Storage</h3>
        <p>Account data lives in our server database; files live in cloud object storage (Cloudflare R2 or equivalent). We do not sell your data, and only share it with service providers necessary to run the app (storage, advertising, sign-in and purchase verification).</p>
        <h3>Your rights</h3>
        <p>You can delete your account entirely at any time from within the app (Profile → "Delete my account"), or via the web <a href="/delete-account">account deletion page</a>. Deletion unlinks your name from any materials you uploaded (published materials remain available without your name) and permanently deletes your account.</p>
        ${contactEmail ? `<h3>Contact</h3><p>For privacy questions: <a href="mailto:${contactEmail}">${contactEmail}</a></p>` : ""}
      </section>
    `,
    }),
  );
});

router.get("/terms", (_req, res): void => {
  const contactEmail = readContactEmail();
  res.type("html").send(
    pageShell({
      titleAr: "شروط الاستخدام وسياسة المحتوى",
      titleEn: "Terms of Use & Content Policy",
      bodyHtml: `
      <section lang="ar">
        <h2>شروط الاستخدام وسياسة المحتوى</h2>
        <p>مراجعي مكتبة مجانية لمصادر دراسية يرفعها طلاب لطلاب آخرين. باستخدامك التطبيق، أنت توافق على:</p>
        <h3>ممنوع رفعه</h3>
        <ul>
          <li>أي محتوى مسروق أو محمي بحقوق نشر لا تملك إذناً بمشاركته.</li>
          <li>أي محتوى مسيء، تمييزي، أو مخالف للقانون.</li>
          <li>معلومات شخصية لطرف ثالث بدون إذنه.</li>
          <li>محتوى غير متعلق بالغرض التعليمي للتطبيق (محتوى مزعج/دعائي).</li>
        </ul>
        <h3>حق الإدارة</h3>
        <p>لفريق إدارة مراجعي الحق الكامل في مراجعة أي محتوى قبل نشره، وإزالة أي محتوى منشور دون إشعار مسبق إذا خالف هذه الشروط، وتعليق أو حظر أي حساب يُساء استخدامه بشكل متكرر.</p>
        <h3>التبليغ</h3>
        <p>يمكن لأي مستخدم (بتسجيل دخول أو بدونه) الإبلاغ عن أي ملف أو بروفايل مساهم أو طلب مخالف عبر زر "الإبلاغ" المتاح في كل صفحة من هذه الصفحات داخل التطبيق.</p>
        <h3>الإيقاف</h3>
        <p>عند تكرار رفض الملفات أو تلقي بلاغات مؤكدة، قد تُعلَّق صلاحية الرفع مؤقتاً، أو يُحظر الحساب بالكامل من إنشاء محتوى جديد (الرفع، الطلب، اقتراح بطاقات المراجعة) حتى تتم مراجعته.</p>
        <h3>حقوق الملكية الفكرية</h3>
        <p>إذا كنت تعتقد أن ملفاً منشوراً ينتهك حقوق ملكيتك الفكرية، راجع <a href="/takedown">صفحة طلب إزالة المحتوى</a>.</p>
        ${contactEmail ? `<h3>تواصل معنا</h3><p><a href="mailto:${contactEmail}">${contactEmail}</a></p>` : ""}
      </section>
      <div class="lang-divider">— ENGLISH —</div>
      <section lang="en">
        <h2>Terms of Use & Content Policy</h2>
        <p>Maraje3 is a free library of study materials uploaded by students for other students. By using the app, you agree to the following.</p>
        <h3>Not allowed</h3>
        <ul>
          <li>Stolen or copyrighted content you don't have permission to share.</li>
          <li>Offensive, discriminatory, or unlawful content.</li>
          <li>A third party's personal information without their consent.</li>
          <li>Content unrelated to the app's educational purpose (spam/advertising).</li>
        </ul>
        <h3>Admin rights</h3>
        <p>The Maraje3 team may review any content before publishing, remove any published content without prior notice if it violates these terms, and suspend or ban any account that's repeatedly misused.</p>
        <h3>Reporting</h3>
        <p>Any user (signed in or not) can report a file, a contributor's profile, or a request using the "Report" button available on each of those screens in the app.</p>
        <h3>Suspension</h3>
        <p>Repeated rejected uploads or confirmed reports may temporarily suspend upload privileges, or fully block the account from creating new content (uploads, requests, flashcard suggestions) pending review.</p>
        <h3>Intellectual property</h3>
        <p>If you believe a published file infringes your intellectual property rights, see the <a href="/takedown">content takedown request page</a>.</p>
        ${contactEmail ? `<h3>Contact</h3><p><a href="mailto:${contactEmail}">${contactEmail}</a></p>` : ""}
      </section>
    `,
    }),
  );
});

router.get("/delete-account", (_req, res): void => {
  const contactEmail = readContactEmail();
  res.type("html").send(
    pageShell({
      titleAr: "حذف الحساب",
      titleEn: "Delete Account",
      bodyHtml: `
      <section lang="ar">
        <h2>حذف الحساب</h2>
        <h3>من داخل التطبيق (الطريقة الأسرع)</h3>
        <p>افتح تطبيق مراجعي ← "حسابي" ← زر "حذف حسابي" في الأسفل ← أكّد الحذف. يُحذف حسابك فوراً ونهائياً، ويُفك ربط اسمك عن أي ملفات رفعتها (تبقى الملفات المنشورة متاحة للطلاب الآخرين بدون اسمك).</p>
        <h3>بدون الدخول للتطبيق</h3>
        ${
          contactEmail
            ? `<p>راسلنا من البريد المرتبط بحساب جوجل الذي سجّلت به الدخول على <a href="mailto:${contactEmail}?subject=${encodeURIComponent("طلب حذف حساب — مراجعي")}">${contactEmail}</a> بعنوان "طلب حذف حساب"، وسنحذف حسابك خلال أيام قليلة ونؤكد لك ذلك بالرد على رسالتك.</p>`
            : `<p>تواصل مع فريق الدعم (راجع صفحة "عن التطبيق" داخل التطبيق للحصول على وسيلة تواصل محدّثة) بطلب حذف الحساب، مع ذكر اسم العرض المستخدم في حسابك.</p>`
        }
        <h3>ماذا يُحذف</h3>
        <ul>
          <li>حسابك بالكامل (الاسم، الصورة، ربط جوجل، ربط تليجرام إن وُجد).</li>
          <li>اسمك وصورتك من أي ملف رفعته (الملف نفسه قد يبقى منشوراً بدون نسبته لك، إلا إذا طلبت إزالته أيضاً في نفس الرسالة).</li>
        </ul>
      </section>
      <div class="lang-divider">— ENGLISH —</div>
      <section lang="en">
        <h2>Delete Account</h2>
        <h3>From within the app (fastest)</h3>
        <p>Open the Maraje3 app → "Profile" → the "Delete my account" button at the bottom → confirm. Your account is deleted immediately and permanently, and your name is unlinked from any materials you uploaded (published materials remain available to other students without your name).</p>
        <h3>Without opening the app</h3>
        ${
          contactEmail
            ? `<p>Email us from the address linked to the Google account you signed in with, at <a href="mailto:${contactEmail}?subject=${encodeURIComponent("Account deletion request — Maraje3")}">${contactEmail}</a>, subject "Account deletion request", and we'll delete your account within a few days and confirm by replying to your message.</p>`
            : `<p>Contact support (see the "About" screen in the app for a current contact method) with an account deletion request, including the display name on your account.</p>`
        }
        <h3>What gets deleted</h3>
        <ul>
          <li>Your entire account (name, photo, Google link, Telegram link if any).</li>
          <li>Your name and photo from any material you uploaded (the file itself may remain published without attribution to you, unless you also ask for it to be removed in the same message).</li>
        </ul>
      </section>
    `,
    }),
  );
});

router.get("/takedown", (_req, res): void => {
  const contactEmail = readContactEmail();
  res.type("html").send(
    pageShell({
      titleAr: "طلب إزالة محتوى (حقوق ملكية)",
      titleEn: "Content Takedown Request (IP Rights)",
      bodyHtml: `
      <section lang="ar">
        <h2>طلب إزالة محتوى لانتهاك حقوق ملكية فكرية</h2>
        <p>إذا كنت صاحب حق نشر أو ملكية فكرية وتعتقد أن ملفاً على مراجعي ينتهك حقوقك، أرسل لنا الطلب وسنراجعه ونزيل الملف إذا ثبتت صحة الطلب.</p>
        <h3>ما نحتاجه في طلبك</h3>
        <ul>
          <li>رابط الملف المخالف داخل التطبيق (أو اسمه الدقيق والمادة/الكلية التابع لها).</li>
          <li>وصف لحقك في هذا المحتوى (مثلاً: أنت مؤلفه الأصلي، أو تملك حقوق نشره).</li>
          <li>بيان بحسن نية بأن استخدام المحتوى غير مُصرَّح به.</li>
          <li>وسيلة تواصل للرد عليك.</li>
        </ul>
        ${
          contactEmail
            ? `<p>أرسل الطلب إلى <a href="mailto:${contactEmail}?subject=${encodeURIComponent("طلب إزالة محتوى — حقوق ملكية")}">${contactEmail}</a> بعنوان "طلب إزالة محتوى — حقوق ملكية".</p>`
            : `<p>تواصل مع فريق الإدارة (راجع صفحة "عن التطبيق" داخل التطبيق لوسيلة التواصل المحدّثة).</p>`
        }
        <p>بديلاً، يمكن لأي مستخدم استخدام زر "الإبلاغ" على الملف مباشرة داخل التطبيق واختيار سبب "انتهاك حقوق نشر".</p>
      </section>
      <div class="lang-divider">— ENGLISH —</div>
      <section lang="en">
        <h2>Content Takedown Request (Intellectual Property)</h2>
        <p>If you hold copyright or other IP rights and believe a file on Maraje3 infringes them, send us a request and we'll review it and remove the file if it's substantiated.</p>
        <h3>What to include</h3>
        <ul>
          <li>A link to the file in the app (or its exact name and which subject/faculty it's under).</li>
          <li>A description of your right in this content (e.g., you are its original author, or you hold its publishing rights).</li>
          <li>A good-faith statement that the use is unauthorized.</li>
          <li>A way for us to reach you.</li>
        </ul>
        ${
          contactEmail
            ? `<p>Send your request to <a href="mailto:${contactEmail}?subject=${encodeURIComponent("Content takedown request — IP rights")}">${contactEmail}</a>, subject "Content takedown request — IP rights".</p>`
            : `<p>Contact the admin team (see the "About" screen in the app for a current contact method).</p>`
        }
        <p>Alternatively, any user can use the "Report" button directly on the file inside the app and choose the "Copyright violation" reason.</p>
      </section>
    `,
    }),
  );
});

export default router;
