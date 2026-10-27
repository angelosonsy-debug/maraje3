# Store Listing — مراجعي / Maraje3

Draft copy for Play Console's **Store listing** page. Character counts are
Play's actual limits (short description ≤ 80, title ≤ 30). Swap in real
screenshots/feature graphic before submitting — see `play-checklist.md`.

## App name (≤ 30 chars)

- **Arabic:** مراجعي
- **English:** Maraje3 — Student Library

## Short description (≤ 80 chars)

- **Arabic (৪৬ حرفاً):** مكتبة مجانية لملخصات ومذكرات الجامعات المصرية، من طلاب لطلاب
- **English (73 chars):** Free library of Egyptian university study notes, by students, for students

## Full description

### Arabic

```
مراجعي — مكتبة مذاكرة مجانية لطلاب الجامعات المصرية

تطبيق فيه ملخصات، مذكرات، وامتحانات سابقة لمواد كليات مصرية، يرفعها طلاب
فعليين عشان يساعدوا زمايلهم. تقدر تتصفح وتنزّل أي ملف من غير ما تسجّل دخول
خالص.

إيه اللي هتلاقيه:
• تصفح حسب جامعتك، كليتك، فرقتك، والمادة
• بحث سريع بالعربي والإنجليزي
• تنزيل وحفظ الملفات للمذاكرة بدون نت
• بطاقات مراجعة (Flashcards) لكل مادة، بتقدّم مذاكرة شخصي على جهازك
• عدّاد تنازلي لامتحاناتك
• لوحة "مطلوب" لو مش لاقي مادة معينة — المساهمين بيردّوا عليها
• نظام تقدير للمساهمين: ألقاب، لوحة صدارة، وPremium مجاني لمن يساهم بكثافة

تسجيل الدخول (اختياري بجوجل) مطلوب بس لو حابب ترفع ملف، تطلب مادة، أو
تتابع مساهماتك — التصفح والتنزيل شغالين دايماً من غير حساب.

التطبيق مجاني بالكامل، وفيه نسخة Premium اختيارية بشراء لمرة واحدة (بدون
اشتراك متكرر) بتشيل الإعلانات وتفتح تنزيل غير محدود.
```

### English

```
Maraje3 — Free study library for Egyptian university students

A library of summaries, lecture notes, and past exams for Egyptian
university courses, uploaded by real students to help their classmates.
Browse and download any file without signing in at all.

What's inside:
• Browse by your university, faculty, year, and subject
• Fast search in Arabic and English
• Download and save files to study offline
• Flashcards for every subject, with personal on-device study progress
• An exam countdown
• A "requested materials" board — contributors fulfill what's missing
• A recognition system for contributors: titles, a leaderboard, and free
  Premium for top contributors

Signing in (optional, via Google) is only needed to upload a file, request
one, or track your own contributions — browsing and downloading always
work without an account.

The app is fully free, with an optional one-time-purchase Premium tier (no
recurring subscription) that removes ads and unlocks unlimited downloads.
```

## Category

Education

## Content rating

Expect "Everyone" pending the Play Console questionnaire — the app has no
mature content by design; user-uploaded files go through admin review
before publishing (rule 5 of the project's binding spec), and a report
mechanism exists for anything that slips through.

## Contact details (for the listing page)

- Email: set `PUBLIC_CONTACT_EMAIL` / `EXPO_PUBLIC_CONTACT_EMAIL` (see
  `.env.example`) and reuse the same address here.
- Privacy policy URL: `https://<PUBLIC_BASE_URL>/privacy`
- Website: `https://<PUBLIC_BASE_URL>` (optional — only if you want the
  share-link domain listed as the app's website)

## Not yet prepared (manual, outside this repo)

- App icon at 512×512 (the app currently ships `icon_2.png` at whatever
  size is in `artifacts/maraje3/assets/images/` — verify/export a
  dedicated 512×512 PNG for the Play Console upload, which is a distinct
  asset from the in-app adaptive icon).
- Feature graphic (1024×500).
- Phone/tablet screenshots.
- A short promo video (optional).

These are visual assets a human needs to create/export and are explicitly
out of scope for this stage — see `play-checklist.md`.
