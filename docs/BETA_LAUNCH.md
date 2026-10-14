# ExamSaathi Alerts beta launch runbook

## Security review snapshot

The workspace review found no verified code vulnerabilities in the RLS definitions, server-side admin-role check, API middleware ordering, request schemas, CORS allowlist, Helmet setup, or checked client bundle. The unsubscribe endpoint now has a route-specific limit of 20 requests per 15 minutes; beta feedback is limited to five submissions per hour per IP. Express applies the general 100-request/15-minute `/api` limiter.

Authentication signup and login use Supabase Auth directly from the browser, not Express. Set and verify Supabase Auth rate limits and abuse protection in the Supabase dashboard; a client-side limit would not be an effective security boundary. Production RLS, Auth limits, deployment headers/proxy behavior, CORS origin, and bundle contents must be rechecked against the live project. Playwright security tests below verify cross-user RLS behavior and candidate/admin route authorization against a disposable staging project.

## 1. Create and configure Supabase

1. Create a dedicated beta Supabase project. Do not use a production or personal-data project as an E2E target.
2. Install the Supabase CLI, authenticate, then from the repository root link and apply migrations:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Confirm that migrations `202610140001` through `202610140007` are recorded as applied.

3. In **Authentication → URL Configuration**, set the Site URL to the canonical Cloudflare Pages/custom-domain URL. Add exact redirect URLs for `/verify-email`, `/reset-password`, and any local development URL. Do not use a wildcard production redirect.
4. Set conservative signup/sign-in/OTP rate limits in **Authentication → Rate Limits**. Enable CAPTCHA/Turnstile protection if the plan and beta risk require it. The client talks directly to Supabase Auth, so these provider-side limits are the auth boundary.
5. Create an administrator using Supabase Auth. Grant the role only to that account through the SQL editor:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('ADMIN_AUTH_USER_UUID', 'admin');
   ```

6. Check RLS is enabled and the expected policies/grants exist for `profiles`, `notification_preferences`, `user_vacancy_matches`, `user_vacancy_actions`, `user_vacancy_action_history`, and `beta_feedback`. Confirm the queue, notification logs, feedback submissions, and provider event tables have no end-user read policies.
7. Keep one API instance for beta if using the in-process cron scheduler. Do not configure more than one server replica until schedulers are moved to a single worker or distributed lease.

## 2. Configure and deploy the Express API (Render or Railway)

Deploy the repository root so npm workspaces and the root lockfile are available.

**Render**

- Create a Node web service from the repository.
- Root directory: repository root.
- Build command: `npm ci`.
- Start command: `npm run start --workspace @examsaathi/server`.
- Health-check path: `/api/health`.
- Use one instance for beta while the cron scheduler runs in-process.

**Railway**

- Create a project from the repository and use the repository root as the service root.
- Build command: `npm ci`.
- Start command: `npm run start --workspace @examsaathi/server`.
- Set the public service port through `PORT` (Railway may inject this automatically).
- Expose `/api/health` as the service health check and use one replica while cron is in-process.

Set these **server-only** environment variables in the hosting provider:

| Variable                    | Beta value                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                  | `production`                                                                                                                                           |
| `PORT`                      | Provider-assigned port; Render/Railway normally inject it                                                                                              |
| `TRUST_PROXY_HOPS`          | `1` only after confirming the host terminates requests through exactly one trusted proxy and overwrites/normalizes forwarded IP headers; otherwise `0` |
| `APP_URL`                   | Canonical browser origin, e.g. `https://beta.example.in` (no trailing slash)                                                                           |
| `API_URL`                   | Public API origin, e.g. `https://api-beta.example.in` (no trailing slash)                                                                              |
| `SUPABASE_URL`              | Project URL from Supabase                                                                                                                              |
| `SUPABASE_ANON_KEY`         | Supabase publishable/anon key; still server config, not a service credential                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role secret, server only                                                                                                                       |
| `RESEND_API_KEY`            | Resend API key, server only                                                                                                                            |
| `RESEND_FROM_EMAIL`         | Verified sender, e.g. `alerts@example.in`                                                                                                              |
| `RESEND_WEBHOOK_SECRET`     | Resend webhook signing secret (`whsec_...`)                                                                                                            |
| `UNSUBSCRIBE_TOKEN_SECRET`  | Random secret of at least 32 characters; keep stable across deploys                                                                                    |
| `NOTIFICATION_DRY_RUN`      | `true` until end-to-end email checks pass; `false` only after approval                                                                                 |
| `NOTIFICATION_CRON`         | `*/5 * * * *` for beta; in a disposable E2E project use `* * * * *`                                                                                    |
| `INGESTION_DRY_RUN`         | `true` until a source is explicitly cleared and enabled                                                                                                |
| `INGESTION_CRON`            | `0 */4 * * *`                                                                                                                                          |
| `LLM_PROVIDER`              | `openai` if live ingestion is explicitly enabled                                                                                                       |
| `LLM_API_KEY`               | Optional until live ingestion; server secret                                                                                                           |
| `LLM_MODEL`                 | `gpt-4o-mini` or an approved compatible model                                                                                                          |
| `LLM_BASE_URL`              | Optional; only for an approved OpenAI-compatible endpoint                                                                                              |
| `ADMIN_ALERT_EMAIL`         | Monitored administrator mailbox; optional until ingestion alerts are enabled                                                                           |

Use `NOTIFICATION_DRY_RUN=true` in the first deployment. Leave ingestion disabled/dry-run: currently no automated source is cleared for use. Do not put service-role, Resend, LLM, or webhook signing secrets in Cloudflare/Vite variables.

## 3. Build and deploy the client (Cloudflare Pages)

1. Create a Pages project connected to the repository.
2. Root directory: repository root. Build command: `npm ci && npm run build`. Build output directory: `client/dist`.
3. Set the following Pages environment variables for production and preview environments:

   | Variable                 | Value                                                      |
   | ------------------------ | ---------------------------------------------------------- |
   | `VITE_APP_URL`           | Canonical client origin, e.g. `https://beta.example.in`    |
   | `VITE_API_URL`           | Full API base path, e.g. `https://api-beta.example.in/api` |
   | `VITE_SUPABASE_URL`      | Public Supabase project URL                                |
   | `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key only                         |

4. Add the custom domain and HTTPS. Use one canonical production origin because server CORS allows the exact `APP_URL`.
5. Ensure the SPA fallback serves `index.html` for `/dashboard`, `/matches/*`, `/privacy`, `/terms`, and other client-side routes. Cloudflare Pages' default SPA behavior applies when there is no top-level `404.html`; test a direct reload on each route.
6. Restrict preview deployments and never attach production secrets to untrusted preview builds.

## 4. Configure email delivery and event reporting

1. Add and verify the sender domain in Resend. Publish the exact DNS records shown by Resend; do not substitute guessed record names or values.
2. Publish the provider-issued SPF TXT record. If the domain already has SPF, merge the authorized sender into the existing SPF record; do not publish multiple SPF TXT records for the same hostname.
3. Publish the DKIM record(s) provided by Resend (commonly selector-based CNAME records). Wait for Resend to show the domain as verified.
4. Add a DMARC TXT record at `_dmarc.example.in`. Start with a monitored policy such as `v=DMARC1; p=none; rua=mailto:dmarc-reports@example.in; adkim=r; aspf=r; pct=100`. Use an address you monitor. Review alignment and aggregate reports before moving to `p=quarantine` and then `p=reject`; do not tighten blindly.
5. Send test messages to Gmail and Outlook. Inspect message headers for SPF, DKIM, and DMARC pass/alignment; check spam placement, sender name, unsubscribe link, and both language templates.
6. In Resend, create a webhook for `email.delivered` and `email.bounced` pointing to `https://api-beta.example.in/api/webhooks/resend`. Put its signing secret in `RESEND_WEBHOOK_SECRET`. The endpoint verifies Svix signatures and deduplicates event IDs.
7. Apply and verify a real send only after the dry-run queue and recipient consent are checked. Keep the unsubscribe endpoint accessible without login.

## 5. Beta E2E setup

Apply migrations to an isolated staging project and configure its server with `NOTIFICATION_DRY_RUN=true` and `NOTIFICATION_CRON=* * * * *`. Configure Supabase Auth for automatic email confirmation only in this disposable test project (or provide an automated test mailbox/confirmation flow).

Seed these E2E fixtures in staging:

- `E2E_VACANCY_ID`: an existing verified-open vacancy with a future deadline, usable for the candidate match and action flow.
- `E2E_VERIFIED_DRAFT_ID`: an `awaiting_verification` vacancy with `verification_status='verified'` and all three checklist items true.
- `E2E_NOTIFICATION_USER_ID`: an existing test user with email consent enabled and a `preliminary_match` for that draft at its current `rules_version`.
- `E2E_CANDIDATE_EMAIL` / `E2E_CANDIDATE_PASSWORD` and `E2E_OTHER_USER_EMAIL` / `E2E_OTHER_USER_PASSWORD`: two pre-provisioned candidate accounts for RLS tests.
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`: the staging admin account.
- Ensure notification preferences allow the test notification and `email_enabled=true`.

Set these variables in the local test shell (never commit them):

```powershell
$env:E2E_BASE_URL = "https://beta.example.in"
$env:E2E_ALLOW_REMOTE = "true"
$env:E2E_API_URL = "https://api-beta.example.in"
$env:E2E_SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:E2E_SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY"
$env:E2E_SUPABASE_SERVICE_ROLE_KEY = "YOUR_STAGING_SERVICE_ROLE_KEY"
$env:E2E_UNSUBSCRIBE_TOKEN_SECRET = "SAME_VALUE_AS_STAGING_UNSUBSCRIBE_TOKEN_SECRET"
$env:E2E_VACANCY_ID = "VERIFIED_OPEN_VACANCY_UUID"
$env:E2E_VERIFIED_DRAFT_ID = "VERIFIED_AWAITING_DRAFT_UUID"
$env:E2E_NOTIFICATION_USER_ID = "CONSENTED_MATCHED_TEST_USER_UUID"
$env:E2E_ADMIN_EMAIL = "staging-admin@example.test"
$env:E2E_ADMIN_PASSWORD = "STAGING_ADMIN_PASSWORD"
$env:E2E_CANDIDATE_EMAIL = "candidate-a@example.test"
$env:E2E_CANDIDATE_PASSWORD = "CANDIDATE_A_PASSWORD"
$env:E2E_OTHER_USER_EMAIL = "candidate-b@example.test"
$env:E2E_OTHER_USER_PASSWORD = "CANDIDATE_B_PASSWORD"
npx playwright install chromium
npm run test:e2e
```

For a local Vite run omit `E2E_BASE_URL`; start the Express server separately with test-project environment variables. `E2E_ALLOW_REMOTE=true` is required for non-local URLs because tests create an account, write a match, publish a vacancy, update application status, and unsubscribe a test user. Never run against production.

The Playwright suite covers:

- Candidate signup → four-step profile → seeded match → detail → Applied.
- Admin publish → notification worker dry-run log.
- Signed unsubscribe confirmation and persisted consent withdrawal.
- Cross-user profile/role RLS reads and candidate denial on admin API.

## 6. Weekly beta metrics

Run [weekly-beta-metrics.sql](../server/ops/weekly-beta-metrics.sql) in the Supabase SQL editor. It reports wrong-match, missed-vacancy and irrelevant-alert counts; provider-confirmed bounce rate; repeated successful sends per queue item (duplicate-success rate); unsubscribe-per-sent-email rate; and returning users.

Bounce rate is unavailable until the Resend webhook is verified and migration 007 is deployed. Duplicate queue items are prevented by a unique idempotency key; the query measures repeated successful logs per queue item, not enqueue conflicts that were ignored before insertion. A zero rate should be read as “no duplicates observed in recorded successful sends,” not evidence about unrecorded provider events.

## 7. Post-deploy smoke checklist

- [ ] `GET https://api-beta.example.in/api/health` returns HTTP 200.
- [ ] Client root and direct reloads for `/privacy`, `/terms`, `/about`, `/signup`, `/dashboard`, `/matches/<uuid>`, and `/notification-settings` return the SPA.
- [ ] Check response headers for Helmet protections (CSP, `X-Content-Type-Options`, frame/referrer protections); confirm the API does not emit `X-Powered-By`.
- [ ] From the approved client origin, API requests succeed; from an unapproved origin, browser CORS does not allow access.
- [ ] Confirm `TRUST_PROXY_HOPS` matches the actual provider proxy chain and that spoofed `X-Forwarded-For` cannot change the address used by rate limits.
- [ ] Sign up and verify email; log in, complete the profile, withdraw consent, and confirm no notification is queued for that user.
- [ ] Sign in as a candidate and confirm another test user's profile/action/history cannot be read through REST; confirm a candidate receives HTTP 403 from `/api/admin/vacancies`.
- [ ] Sign in as the intended admin and confirm a non-admin role is rejected server-side.
- [ ] Submit a test feedback report and confirm it is stored; do not include real identity data.
- [ ] Publish a staging notice with dry-run enabled; confirm queue/log status `dry_run` and no external email was sent.
- [ ] Open the unsubscribe URL: GET must show confirmation without opting out; POST must disable email consent.
- [ ] Confirm Resend sender-domain verification, SPF/DKIM/DMARC alignment, webhook signature verification, and bounce event storage.
- [ ] Check `NOTIFICATION_DRY_RUN=true`, `INGESTION_DRY_RUN=true`, canonical `APP_URL`, `API_URL`, and CORS behavior before inviting users.
- [ ] Add and monitor a real support/grievance contact, finalize privacy retention and deletion practices with counsel, and obtain legal review of the DPDP Act-aware policy/terms before external beta invitations.
