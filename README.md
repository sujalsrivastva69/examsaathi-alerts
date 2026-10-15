# ExamSaathi Alerts

A mobile-first government vacancy alert platform for Indian job aspirants. The repository is an npm-workspaces monorepo with a React client, Express API, and Supabase migration directory.

## File tree

```text
examnotify/
├── package.json                  # npm workspaces and shared scripts
├── client/
│   ├── .env.example
│   └── src/
│       ├── admin/                 # vacancy editor, ingestion review, notifications
│       ├── auth/                  # Supabase authentication
│       ├── candidate/             # dashboard, vacancy detail, alert settings
│       ├── profile/
│       ├── public/
│       ├── tools/                # browser-side free tools
│       └── lib/
├── server/
│   ├── .env.example
│   ├── app.js
│   ├── controllers/ routes/ middleware/
│   ├── services/
│   │   ├── ingestion/             # source registry, extraction, validation, scheduler
│   │   ├── matching/
│   │   └── notifications/
│   ├── tests/
│   │   ├── ingestion/fixtures/    # five synthetic notices
│   │   ├── matching/
│   │   └── notifications/
│   └── utils/
├── supabase/migrations/           # ordered forward migrations
├── shared/                       # shared age/date utilities
├── e2e/                           # Playwright flows, including security/unsubscribe
├── docs/BETA_LAUNCH.md
├── render.yaml
└── vercel.json
```

## Requirements

- Node.js 20 or newer and npm 10 or newer.
- A Supabase project and a Resend API key for a fully configured server.
- The client uses Tailwind CSS v4 through its PostCSS plugin. `client/src/index.css` imports Tailwind and declares the source paths; custom theme tokens remain in `client/tailwind.config.js`.

## Install and configure

From this directory:

```sh
npm install
```

Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`, then fill in the values. The client example contains only `VITE_` browser-exposed configuration. **Never put the Supabase service-role key or Resend API key in the client environment.** The service-role key bypasses Row Level Security and must remain server-side.

The server validates its complete environment at startup and exits with a clear error if a required value is missing or malformed.

## Run

Start the Vite client and Express API together:

```sh
npm run dev
```

Or start either workspace independently:

```sh
npm run dev:client
npm run dev:server
```

The client runs at `http://localhost:5173`, the API at `http://localhost:3000`, and the health check is `GET http://localhost:3000/api/health`.

### Safely preview public vacancies using the configured Supabase project

If the client shows “API server is running” or vacancies cannot load, the Express API is not running. To preview public database-backed notices without starting scheduled ingestion/notification jobs or allowing API write requests, run the API in `LOCAL_VIEW_MODE` and the browser in `VITE_LOCAL_VIEW_MODE`. In this mode, the API's public vacancy routes still read verified, open records from the configured Supabase project. Auth, signup, profile, admin and other write flows are unavailable in the local preview. No migrations are applied.

In one PowerShell terminal at the repository root, run:

```powershell
$env:LOCAL_VIEW_MODE = "true"
npm run dev:server
```

Keep that terminal open. If the Vite client is already running, press `Ctrl+C` in its terminal to stop it. In a second PowerShell terminal at the repository root, run:

```powershell
$env:VITE_LOCAL_VIEW_MODE = "true"
npm run dev:client
```

Open the Vite URL (usually `http://localhost:5173`). The two environment settings apply only to these terminal processes and do not overwrite `.env` files. `LOCAL_VIEW_MODE` blocks non-read API methods and prevents both schedulers from starting. The public vacancy API can still read public vacancy rows from the Supabase URL configured in `server/.env`; keep that file private. Stop the processes with `Ctrl+C` when finished.

## Validate and format

```sh
npm run build
npm run lint
npm run format:check
npm test
```

## Initial application safeguards

- Match statuses are `preliminary_match`, `needs_review`, `not_matched`, `expired`, and `under_verification`; a preliminary match is not a promise of eligibility.
- Age comparisons must use the cutoff date stated by the vacancy notice.
- Vacancy records must include an official source URL, a `last_verified_at` timestamp, and correction history before being published.
- Collect only data needed for matching. Do not request Aadhaar or document uploads.
- Apply Row Level Security to user-owned Supabase data. Verify administrative privileges on the server; never trust a client-supplied role.
- Notification delivery must be idempotent for each user, vacancy, event, and version.

## Admin vacancy management

Apply the migrations in `supabase/migrations/` in order, only after reviewing the target database's migration history and taking the normal backup. Do not apply an unreviewed migration directly to the main project. Migration `202610150008` adds the expanded tracker; keep `TRACKER_LIFECYCLE_ENABLED=false` until it is applied. Migration `202610150009` adds optional candidate matching inputs; keep `PROFILE_MATCHING_FIELDS_ENABLED=false` until it is applied. The admin migration enables RLS on role, vacancy, change-history, audit, and synthetic preview-profile tables. The browser never receives an admin role flag: every `/api/admin/vacancies` request authenticates the Supabase token and looks up `user_roles` on the server.

Migration `202610150010_compact_matches_and_track_notifications.sql` makes stored match explanations nullable while preserving existing values, and adds notification-enqueue version tracking to vacancies. Review and apply it manually before deploying code that depends on those columns. No migration is automatically applied by the application.

After creating the administrator account through Supabase Auth, grant it access using the Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin');
```

Then sign in and open `http://localhost:5173/admin`. Create a draft with an HTTPS official source, dates and structured eligibility rules. Save content before checking each verification item, submit it for verification, mark it verified, and publish. A content correction to an open vacancy returns it to verification; deadline extensions and state transitions are transactionally written to both `vacancy_changes` and `admin_audit_log`. Draft deletion is a soft-delete so the audit trail remains intact. The preview counts matches among synthetic test profiles only, using age on the notice's age-cutoff date.

## Automated vacancy ingestion

The server can run ingestion on `INGESTION_CRON` (default every four hours) when `ENABLE_INTERNAL_CRON=true`; admins can also run it from `/admin/review`. The default `INGESTION_DRY_RUN=true` processes five local synthetic notices and makes no network, LLM, database, publication, or notification calls. Live ingestion additionally requires an explicitly reviewed and permitted source in `server/services/ingestion/sources.config.js`, `INGESTION_DRY_RUN=false`, and the server-only `LLM_API_KEY`. Sources without verified access permission stay disabled. Text extraction failures and scanned PDFs remain in the admin queue as `needs_manual_entry`; they are not sent to OCR. Add a verified `RESEND_FROM_EMAIL` and `ADMIN_ALERT_EMAIL` if repeated source-failure alerts are wanted.

### Schedule background jobs on free hosting

On hosts that sleep between requests, leave `ENABLE_INTERNAL_CRON=false` and configure an external cron provider to send authenticated `POST` requests to `/api/internal/run-notifications` every five minutes and `/api/internal/run-ingestion` on the desired ingestion schedule (four-hourly by default). Set a random `CRON_SECRET` of at least 32 characters in the server's environment, then configure the provider to send it as the `x-cron-secret` request header. Keep this secret out of URLs, source code, and all `VITE_` client variables. Requests without the secret are rejected; if it is not configured, both endpoints return `503`.

The notification route runs the existing enqueue-and-deliver cycle; the ingestion route runs the existing ingestion pipeline and returns its run summary. `NOTIFICATION_DRY_RUN` and `INGESTION_DRY_RUN` still control their side effects. Do not disable dry-run or enable real sources until email delivery and source permissions are explicitly configured and reviewed. When an always-on host is available, setting `ENABLE_INTERNAL_CRON=true` opts back into the in-process `node-cron` schedules.

The registry contains SSC and the owner-selected Employment News weekly Web Advertisement listing. They are both disabled: robots.txt returned 404 for each during review, and the retrieved policy/disclaimer material did not establish permission for automated fetching; a usable SSC notices feed was not verified. This is not a claim of real-source compatibility. Do not enable either source until access method and terms are confirmed. Permitted sources are checked against robots.txt and fetched with a descriptive User-Agent, a minimum request interval, host allowlists, redirect limits, and response-size limits.

LLM output is strict Zod-validated JSON. Every extracted value includes an exact source quote, an exact page/section label when available, and a confidence score. Invalid JSON and calendar dates are rejected; low-confidence, missing, conflicting, or unsupported evidence is flagged for manual review. Each notice can produce multiple vacancy review items. Approval uses the existing verification checklist and transactional status transitions; only the admin approval flow publishes, reevaluates matches, and enqueues idempotent notifications. The original notice URL, PDF URL, extraction metadata, and correction history are retained.

### Run the ingestion dry run locally

Configure the existing `.env.example` files for the client and server, keeping `INGESTION_DRY_RUN=true` in `server/.env`. Then, from the repository root:

```powershell
npm ci
npm test
npm run dev
```

The test suite and the **Run ingestion** button at `/admin/review` process the five local synthetic notices. In dry-run mode the pipeline makes no source, LLM, database-write, publication, or notification calls. Live ingestion also requires an admin account and a source that has been explicitly reviewed and permitted; neither registered source is enabled now.

## Eligibility matching

`server/services/matching/evaluate-vacancy.js` is the pure eligibility evaluator. It returns only preliminary, review, not-matched, expired, or under-verification states and supplies an English and Hindi reason for every eligibility check. Age is evaluated against the notice cutoff date; a February 29 birthday reaches its age on March 1 in non-leap years. The engine does not infer equivalence, discipline, domicile, category relaxations, or experience from missing candidate data. The profile and admin-vacancy services re-evaluate stored matches after changes, and rule/deadline changes increment the vacancy's `rules_version`. Apply migration 004 after the first three migrations. Run `npm test` to execute the ingestion and notification Node tests and the 51-case Vitest matcher suite.

## Email notifications

Apply the required migrations in order. Email alerts require the explicit email consent (`email_enabled`); needs-review alerts are a separate optional preference. `NOTIFICATION_DRY_RUN=true` is the safe default and writes rendered messages to the server log instead of contacting Resend. Set it to `false` to deliver. `NOTIFICATION_CRON` defaults to every five minutes and handles queue batches, 3-day/1-day reminders, and stale-verification flags when internal cron is enabled. Daily and weekly digest windows are due at 09:00 India Standard Time and deliver at the first worker tick at or after that window. The worker continues claiming notification batches for up to four minutes per cycle and returns any claimed-but-unprocessed rows to the queue. Resend delivery retries use exponential backoff for at most three attempts; permanently failed messages are listed at `/admin/notifications` for a manual retry. Set `API_URL` to the externally reachable Express base URL in deployments where it differs from `APP_URL`; it is used for signed unsubscribe links. `UNSUBSCRIBE_TOKEN_SECRET` is required in production and should be a stable random secret of at least 32 characters; only development/test can fall back to the service-role key. Opening an unsubscribe link presents a confirmation page, while its POST endpoint supports one-click unsubscribe and turns off email consent without login. Complaints and permanent bounces are stored as provider events and suppress further email for the associated user. The authenticated tracker supports saved, interested, application-started, submitted, admit-card, exam, result, and next-stage statuses, plus optional private notes. Submitted and not-interested applications are excluded from deadline reminders. Migration 008 preserves older `started` and `applied` statuses by mapping them to `application_started` and `submitted`. `TRACKER_LIFECYCLE_ENABLED` defaults to `false` and must only be set to `true` after migration 008 has been applied to that database; the previous tracker remains active while it is false.

## Candidate dashboard

Apply migration 006 after migrations 001–005. Signed-in candidates can open `/dashboard` to filter preliminary matches and review their bilingual match explanations, notice/correction timeline, deadline, and application tracker. Tracker status changes are recorded with timestamps. `/notification-settings` controls email consent, immediate/daily/weekly delivery windows, and deadline reminders. Daily and weekly windows are 09:00 India Standard Time; reminder emails are suppressed when the reminder toggle is off. The candidate API returns only the signed-in user's matches, tracker data, and history.

## Public vacancy browsing

The public home page has a search form that opens `/jobs?q=...`. The listing page filters the database-backed, verified open notices by text, qualification, recruiting organization and state. `/jobs/:id` shows the notice dates, eligibility rules, last verification date and official links, and `/calendar` displays application opening/deadline dates for those same notices. `/preparation` links to the existing application checklist, profile and vacancy browsing flow; it clearly states that study plans and mock tests are not currently provided. Public vacancies come only from the admin-approved vacancy table; these screens do not use mock notices. The Employment News connector creates drafts only when live ingestion is explicitly enabled, so the public list remains empty until an administrator reviews and publishes verified vacancies. The public vacancy API is at `/api/public/vacancies` and `/api/public/vacancies/:id`.

## Beta launch readiness

Migration 007 adds authenticated beta feedback storage and service-role-only Resend delivery-event storage. Configure the Resend webhook at `/api/webhooks/resend` with `RESEND_WEBHOOK_SECRET` before using provider bounce metrics. The feedback form is available at `/feedback`; static `/privacy`, `/terms`, and `/about` pages are English/Hindi. The privacy policy is a plain-language draft that needs legal review before public beta invitations.

See [docs/BETA_LAUNCH.md](./docs/BETA_LAUNCH.md) for the security review snapshot, Vercel/Render deployment instructions, exact environment variables, email domain setup, Playwright staging test setup, post-deploy smoke tests, and the weekly metrics query in `server/ops/weekly-beta-metrics.sql`. Run `npm run test:e2e` only against a dedicated disposable staging project; it creates accounts and changes database state.
