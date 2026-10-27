# Data Safety (Google Play Console form) — مراجعي / Maraje3

This maps directly onto Play Console's **App content → Data safety** form.
Every line below is extracted from the actual code (schemas, routes, client
calls) as of Stage 8 — not a generic template. Re-check this file whenever
you add a new data-collecting feature before resubmitting the form, since
Play treats an inaccurate form as a policy violation.

## Does your app collect or share any of the required user data types?

**Yes.**

## Data types collected

| Category | Type | Collected? | Shared with 3rd party? | Optional? | Purpose | Where in code |
|---|---|---|---|---|---|---|
| Personal info | Name | Yes (Google display name) | No | Yes — only if you sign in | Account functionality, attribution on uploads | `lib/auth.ts` `verifyGoogleIdToken`, `usersTable.displayName` |
| Personal info | Email address | **No** — the app only requests the Google ID token's `name`/`picture`/`sub` claims; the email itself is never read or stored (`lib/auth.ts`: `email_verified` is checked but `payload.email` is not persisted, only used as a display-name fallback if `name` is missing) | — | — | — | `lib/auth.ts` |
| Photos | Profile picture | Yes (Google profile photo URL) | No | Yes — only if you sign in | Account functionality, shown on uploads/leaderboard unless identity hidden | `usersTable.photoUrl` |
| Files and docs | User-generated files | Yes (study materials a contributor uploads: file + title + metadata) | No (stored in our own cloud storage, not a third party we share *with*, though the storage provider is a processor — see "Service providers" below) | Yes — only contributors who upload | Core app functionality (the library itself) | `materialsTable`, `lib/storage/*` |
| App activity | App interactions | Yes — per-download event (device id, optional user id, material id, day) for de-duplication and the leaderboard; "thanks" given; report submissions | No | N/A (automatic on download/thanks/report) | Analytics (aggregate counts only), fraud prevention (anti-double-counting), app functionality | `maraje3_downloads` table (`lib/db/src/schema/engagement.ts`), `routes/engagement.ts`, `routes/reports.ts` |
| Device or other IDs | Device ID | Yes — but **not** a hardware identifier: a random UUID generated on-device and stored locally (`expo-crypto` `randomUUID()`), sent as `X-Device-Id` | No | N/A | Fraud prevention (report rate-limiting, download de-dup) for users without an account | `lib/device-id.ts` |
| Financial info | Purchase history | Yes — Premium one-time-purchase verification: Google Play purchase token + product id, stored to recognize the entitlement and support Restore purchases | Yes — to Google (purchase verification via Android Publisher API) | Yes — only Premium purchasers | Account functionality (unlocking Premium) | `usersTable.premiumPurchaseToken/premiumProductId`, `routes/premium.ts`, `lib/google-play.ts` |
| Financial info | Card/payment details | **No** — Premium payment itself is handled entirely by Google Play Billing; this app/server never sees card numbers | — | — | — | — |

## Data NOT collected

- Precise or approximate location
- Contacts
- Calendar
- Health and fitness data
- Messages (SMS/email content)
- Photos/videos from the device camera roll (uploads are explicit file picks, not gallery scans)
- Audio
- Web browsing history
- Search history (the in-app search box is not logged per-query)
- Advertising ID is **not read by our own code** — AdMob's SDK may use it per its own data-safety declaration (see "Third-party SDKs" below); we declare it as collected by the SDK, not by us.

## Push notifications

Exam-countdown reminders (`lib/exams.ts`) are scheduled **locally on-device**
via `expo-notifications`; no push token is ever registered with, or sent
to, any server. Nothing to declare under "App activity" for this feature
beyond the local notification permission itself.

## Telegram linkage (optional)

A contributor can optionally link a Telegram account (`/ربط` bot command)
so submissions sent through the bot are attributed to them. This stores
`telegramUserId`/`telegramChatId` on the user's own row, only after the
user explicitly starts the link flow in-app and confirms it in the bot.
Not collected for users who never use this feature.

## Is all of the user data collected by your app encrypted in transit?

**Yes** — the server is intended to be deployed behind HTTPS only (see
`PUBLIC_BASE_URL`/`PUBLIC_SERVER_URL` conventions throughout `.env.example`,
and `app.set("trust proxy", 1)` + `helmet()` in `artifacts/api-server/src/app.ts`).
Verify the actual production deployment terminates TLS before submitting
the form — this is a hosting/infra concern outside the app's own code.

## Do you provide a way for users to request that their data be deleted?

**Yes.**
- In-app: Profile → "حذف حسابي" (`DELETE /auth/me`, `routes/auth.ts`) —
  immediate, self-service, no waiting period.
- Web: `/delete-account` (`routes/pages.ts`) — instructions for the in-app
  path plus an email-request fallback for someone who can't access the app.

Deleting the account removes the user row entirely; materials they
uploaded remain published (per the content being a shared library
resource) but lose the `uploaderId` link (`ON DELETE SET NULL` on
`materialsTable.uploaderId`), so no further personal data is attached.

## Third-party SDKs with their own data collection (declare separately in Play Console)

- **Google AdMob** (`react-native-google-mobile-ads`) — ads, and (per
  Google's own data-safety disclosure for AdMob) device/advertising
  identifiers for ad personalization, gated by the UMP consent flow
  (`lib/ads.ts`) where required by region.
- **Google Sign-In** (`@react-native-google-signin/google-signin` /
  `google-auth-library` server-side) — handles the OAuth flow itself;
  Google's own privacy policy governs that exchange.
- **Google Play Billing** (`react-native-iap`) — purchase flow; Google
  handles all payment data.

## What was verified vs. not

Verified by reading the actual schema/route code listed above. **Not**
verified: the production hosting environment's TLS configuration, and
whether any CDN/logging layer in front of the deployed server retains
request logs longer than this app's own database does — both are
deployment decisions outside this repository.
