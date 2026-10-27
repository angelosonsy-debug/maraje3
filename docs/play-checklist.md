# Google Play Submission Checklist — مراجعي / Maraje3

Status legend: **جاهز** (ready — built and verified in this repo) ·
**ناقص** (incomplete — code exists but needs a real credential/account to
finish) · **يدوي** (manual — not something code can do; needs a human
action outside this repo).

## 1) Privacy policy

**جاهز.** `/privacy` (`artifacts/api-server/src/routes/pages.ts`) — bilingual
AR/EN, describes actual data collected (see `docs/data-safety.md`), ads,
storage, public name/photo sharing + hide-identity opt-out, deletion
rights. Needs the server deployed at a stable HTTPS domain
(`PUBLIC_BASE_URL`) before the URL can be pasted into Play Console — see
item 10.

## 2) Terms of use & content policy

**جاهز.** `/terms` — bilingual, covers prohibited uploads, admin removal
rights, reporting, and suspension.

## 3) Account deletion

**جاهز.**
- In-app: already existed since Stage 2 (`DELETE /auth/me`, Profile →
  "حذف حسابي").
- Web: `/delete-account` — instructions + email-request fallback, as Play
  requires both for an app with accounts.

## 4) Moderation mechanisms

**جاهز.**
- Report button: materials (Stage 3), requests (Stage 5), and now
  **contributor profiles** (added this stage — `app/contributor/[id].tsx`
  was missing it before; the backend already supported `targetType:
  "profile"` since Stage 4/5).
- Suspend uploads (Stage 4, timed) — unchanged.
- **New this stage:** full account block/unblock — `suspend-account` /
  `reinstate-account` report-resolution actions
  (`routes/reports.ts`), enforced as a hard 403 on every identity-bound
  creation endpoint (`routes/uploads.ts`, `routes/requests.ts`,
  `routes/flashcards.ts` — `isAccountSuspended()` in `lib/auth.ts`). A
  suspended user can still sign in, read/edit their own profile, and
  delete their own account — only new content creation is blocked.
  Admin UI: two new buttons ("حظر الحساب" / "إلغاء الحظر") in the reports
  panel (`app/admin.tsx`).
- `/takedown` — new IP-rights takedown request page.

**ناقص/يدوي caveat:** none of the admin actions above have been exercised
against a real deployed database in this session (no live Postgres
instance here) — they're typechecked and follow the exact pattern of the
Stage 4 `suspend-uploads` action this reuses, but weren't run end-to-end.

## 5) In-app "About" screen

**جاهز.** `app/about.tsx` — app name, version (from `app.json`'s
`expo.version`), links to Privacy/Terms/Takedown (open the deployed
server's pages), a pointer to the per-item Report buttons, a link to
account deletion, and an optional contact email
(`EXPO_PUBLIC_CONTACT_EMAIL`). Reachable from Profile (signed-in and
signed-out) via a new "عن التطبيق" button.

## 6) `docs/` folder

**جاهز.** This checklist, plus `data-safety.md` and `store-listing.md`,
all in this commit.

## 7) Android permissions, applicationId, release signing

- **Permissions — جاهز (verified, no change needed).**
  `artifacts/maraje3/app.json`'s `android` block declares **no** explicit
  `permissions` array, so Expo only includes what its installed native
  modules actually need (internet access is implicit; `expo-notifications`
  adds the Android 13+ notification permission for the exam-countdown
  reminders; `react-native-google-mobile-ads` adds its own ad-related
  permissions). Nothing requests camera, contacts, location, SMS, or
  storage beyond what the file picker/scoped storage already handles —
  confirmed by inspecting `app.json`/`app.config.js`'s plugin list, there
  is no manual permission override to second-guess.
- **applicationId/package — جاهز (verified consistent).** `edu.maraje3.studentlibrary`
  in `app.json`'s `android.package` and `ios.bundleIdentifier`, and in
  `.env.example`'s `ANDROID_PACKAGE_NAME` default (must match for Stage 7's
  Google Play purchase verification to work at all).
- **Release signing — ناقص (build config ready, credentials are manual).**
  `artifacts/maraje3/eas.json`'s `production` profile already builds an
  Android App Bundle (`"buildType": "app-bundle"`, required by Play).
  Signing itself is handled by EAS Build's managed credentials the first
  time you run `eas build --profile production --platform android` (it
  generates and stores a keystore for you unless you upload your own) —
  this is an action you take when you actually run a build, not something
  that can be pre-configured as a file in this repo.

## 8) Pre-Stage-7 manual requirements (from the phased prompt itself, unrelated to Stage 8's own scope)

Restated here only because Play Console submission depends on them too —
tracked in the Stage 7 report, not redone here:
- AdMob account + real ad unit IDs (currently Google's test IDs).
- Play Console in-app product + Google Play Developer API service account
  for Premium purchase verification.

## 9) Pre-Stage-8 manual requirements (from the phased prompt's own manual-steps table)

**يدوي — none of these are things an agent can do:**
- Host the server on a stable HTTPS domain (needed for `/privacy`, `/terms`,
  `/delete-account`, `/takedown`, and the `/m/:id` share links to be real,
  publicly reachable URLs — right now `PUBLIC_BASE_URL` is unset).
- Prepare a 512×512 app icon, a 1024×500 feature graphic, and phone/tablet
  screenshots (see `store-listing.md`).
- Run a 14-day Closed Testing track with 12 testers (a Play Console
  process, not a code change).

## 10) What this stage did NOT touch

- No database migration was run (per your standing instruction to defer
  `pnpm --filter @workspace/db run push` to the end of all stages). Stage 8
  itself needed **no schema change** — `userStatusEnum` ("active"/
  "suspended") already existed since the original schema; this stage only
  started writing to it.
- Did not modify `app.json`/`app.config.js` — permissions were verified
  already minimal, nothing needed changing.
