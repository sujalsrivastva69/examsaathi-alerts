# ExamSaathi Alerts

A mobile-first government vacancy alert platform for Indian job aspirants. The repository is an npm-workspaces monorepo with a React client, Express API, and Supabase migration directory.

## File tree

```text
examnotify/
├── .gitignore
├── .prettierrc.json
├── README.md
├── eslint.config.js
├── package.json                 # npm workspaces and shared scripts
├── client/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── i18n.ts
│       ├── index.css
│       └── main.tsx
├── server/
│   ├── .env.example
│   ├── app.js
│   ├── config/
│   │   └── env.js
│   ├── controllers/
│   │   └── health.controller.js
│   ├── index.js
│   ├── middleware/
│   │   ├── error-handler.js
│   │   ├── not-found.js
│   │   └── validate-request.js
│   ├── package.json
│   ├── routes/
│   │   └── health.routes.js
│   ├── services/
│   │   ├── health.service.js
│   │   ├── matching/
│   │   │   ├── evaluate-vacancy.js
│   │   │   └── match-persistence.service.js
│   │   └── ingestion/
│   │       ├── sources.config.js
│   │       ├── source-fetcher.js
│   │       ├── pdf-text.js
│   │       ├── extraction-prompt.js
│   │       ├── extraction-schema.js
│   │       ├── llm-client.js
│   │       ├── ingestion.service.js
│   │       └── scheduler.js
│   ├── tests/
│   │   ├── ingestion/
│   │   │   ├── fixtures/
│   │   │   └── ingestion.test.js
│   │   └── matching/
│   │       └── evaluate-vacancy.test.js
│   └── utils/
│       └── app-error.js
└── supabase/
    └── migrations/
        ├── 202610140001_profiles_and_notification_preferences.sql
        ├── 202610140002_admin_vacancy_management.sql
        ├── 202610140003_vacancy_ingestion.sql
        ├── 202610140004_user_vacancy_matches.sql
        └── 202610140005_notifications.sql
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

Apply both SQL migrations to the Supabase project. The admin migration enables RLS on role, vacancy, change-history, audit, and synthetic preview-profile tables. The browser never receives an admin role flag: every `/api/admin/vacancies` request authenticates the Supabase token and looks up `user_roles` on the server.

After creating the administrator account through Supabase Auth, grant it access using the Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin');
```

Then sign in and open `http://localhost:5173/admin`. Create a draft with an HTTPS official source, dates and structured eligibility rules. Save content before checking each verification item, submit it for verification, mark it verified, and publish. A content correction to an open vacancy returns it to verification; deadline extensions and state transitions are transactionally written to both `vacancy_changes` and `admin_audit_log`. Draft deletion is a soft-delete so the audit trail remains intact. The preview counts matches among synthetic test profiles only, using age on the notice's age-cutoff date.

## Automated vacancy ingestion

Apply the third migration before using ingestion. The server runs ingestion on `INGESTION_CRON` (default every four hours); admins can also run it from `/admin/review`. The default `INGESTION_DRY_RUN=true` processes five local fake notices and makes no network, LLM, or database calls. For live ingestion, set `INGESTION_DRY_RUN=false`, configure `LLM_API_KEY`, and set a verified `RESEND_FROM_EMAIL` plus `ADMIN_ALERT_EMAIL` for failure alerts.

Source fetching requires both `enabled: true` and `terms_reviewed: true` in `server/services/ingestion/sources.config.js`. The SSC robots URL returned 404 and its terms URL served the generic homepage rather than terms; SSC is therefore listed but disabled until permission can be verified. UPSC returned HTTP 403 and is not configured or bypassed. No source is fetched while its access policy remains unverified. Active sources are checked against robots.txt at runtime and fetched with a descriptive User-Agent, a three-second minimum request interval, host allowlists, redirect limits, and response-size limits.

LLM output is strict JSON and every extracted value must include an exact sentence from the notice and a confidence score. Low-confidence, invalid, missing, or inconsistent values enter `/admin/review`; they are never auto-published. Each notice can produce multiple vacancy review items. Approval requires completed source/date/rule checkboxes and valid vacancy fields; approval and publication are one database transaction so a failure cannot leave an unpublished vacancy marked verified. PDF files are parsed in memory only; the original official URL is retained.

## Eligibility matching

`server/services/matching/evaluate-vacancy.js` is the pure eligibility evaluator. It returns only preliminary, review, not-matched, expired, or under-verification states and supplies an English and Hindi reason for every eligibility check. Age is evaluated against the notice cutoff date; a February 29 birthday reaches its age on March 1 in non-leap years. The engine does not infer equivalence, discipline, domicile, category relaxations, or experience from missing candidate data. The profile and admin-vacancy services re-evaluate stored matches after changes, and rule/deadline changes increment the vacancy's `rules_version`. Apply migration 004 after the first three migrations. Run `npm test` to execute the ingestion and notification Node tests and the 51-case Vitest matcher suite.

## Email notifications

Apply migration 005 after migrations 001–004. Email alerts require the explicit email consent (`email_enabled`); needs-review alerts are a separate optional preference. `NOTIFICATION_DRY_RUN=true` is the safe default and writes rendered messages to the server log instead of contacting Resend. Set it to `false` to deliver. `NOTIFICATION_CRON` defaults to every five minutes and handles queue batches, 3-day/1-day reminders, and stale-verification flags. Resend delivery retries use exponential backoff for at most three attempts; permanently failed messages are listed at `/admin/notifications` for a manual retry. Set `API_URL` to the externally reachable Express base URL in deployments where it differs from `APP_URL`; it is used for signed unsubscribe links. Opening an unsubscribe link presents a confirmation page, while its POST endpoint supports one-click unsubscribe and turns off email consent without login. A user can save `applied` or `not_interested` against a vacancy through the authenticated `/api/vacancy-actions/:id` endpoint; those states suppress deadline reminders.

## Candidate dashboard

Apply migration 006 after migrations 001–005. Signed-in candidates can open `/dashboard` to filter preliminary matches and review their bilingual match explanations, notice/correction timeline, deadline, and application tracker. Tracker status changes are recorded with timestamps. `/notification-settings` controls email consent, immediate/daily/weekly delivery windows, and deadline reminders. Daily and weekly windows are 09:00 India Standard Time; reminder emails are suppressed when the reminder toggle is off. The candidate API returns only the signed-in user's matches, tracker data, and history.

## Beta launch readiness

Migration 007 adds authenticated beta feedback storage and service-role-only Resend delivery-event storage. Configure the Resend webhook at `/api/webhooks/resend` with `RESEND_WEBHOOK_SECRET` before using provider bounce metrics. The feedback form is available at `/feedback`; static `/privacy`, `/terms`, and `/about` pages are English/Hindi. The privacy policy is a plain-language draft that needs legal review before public beta invitations.

See [docs/BETA_LAUNCH.md](./docs/BETA_LAUNCH.md) for the security review snapshot, migration/deployment instructions for Cloudflare Pages and Render/Railway, exact environment variables, email domain setup, Playwright staging test setup, post-deploy smoke tests, and the weekly metrics query in `server/ops/weekly-beta-metrics.sql`. Run `npm run test:e2e` only against a dedicated disposable staging project; it creates accounts and changes database state.
