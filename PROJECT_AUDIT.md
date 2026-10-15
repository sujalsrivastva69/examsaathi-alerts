# ExamSaathi Alerts: repository audit

## Scope and safety

This audit reflects the checked-out repository and its current source, not a live
Supabase inspection. No production database, environment secret, external notice
source, Resend delivery, or E2E Supabase integration was exercised. The project
uses the existing React/Vite client, Express server, Supabase and npm workspaces;
this work does not replace that architecture.

## Existing project tree (major application areas)

```text
examnotify/
  client/
    src/
      admin/                 vacancy administration and ingestion review
      auth/                  Supabase authentication provider
      candidate/             vacancy matches, detail and application tracker
      profile/               candidate profile wizard
      public/                public vacancy views
      tools/                 free tools pages and calculations
      App.tsx                routes
      i18n.ts                Hindi/English strings
  server/
    config/                  environment and Supabase clients
    controllers/             Express request handlers
    routes/                  public, candidate and admin APIs
    services/
      ingestion/             source configuration, extraction, validation, review
      matching/              eligibility matching and persistence
      notifications/         queue, worker, templates and reminder policy
      profile.service.js     candidate profile persistence
    tests/                   ingestion, matching, notifications and tool tests
    utils/                   Zod schemas and shared validation
  shared/                    shared age/date utilities
  e2e/                       Playwright candidate journey
  supabase/migrations/       ordered additive/forward SQL migrations
  docs/                      beta launch guidance
  package.json               workspace scripts
  README.md                  setup and operating guidance
  render.yaml, vercel.json   deployment configuration
```

## Feature inventory

| Area                                                                                           | Current status                                               | Evidence / notes                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project setup and scripts                                                                      | Implemented; build/test/lint are configured                  | Root [package.json](./package.json), workspace manifests. Production build succeeds; see the validation record below.                                                                                                                                                                                                                                                                                                                                         |
| Database schema and RLS                                                                        | Implemented in migrations; live application status unknown   | [supabase/migrations](./supabase/migrations) defines profiles, vacancies, roles, matches, notifications, ingestion and beta feedback. User-facing rows have owner policies in the migrations; service-role access is server-side. SQL has not been applied or verified against the main project in this audit.                                                                                                                                                |
| Authentication and candidate profiles                                                          | Partially implemented                                        | [client/src/auth/AuthProvider.tsx](./client/src/auth/AuthProvider.tsx), [client/src/profile/ProfileWizard.tsx](./client/src/profile/ProfileWizard.tsx), [server/services/profile.service.js](./server/services/profile.service.js). Auth and profile basics exist. Matching input completeness was missing: category, discipline and experience are now optional additions in this phase.                                                                     |
| Admin vacancy CRUD and verification                                                            | Implemented in code; live permissions not integration-tested | [server/services/admin-vacancy.service.js](./server/services/admin-vacancy.service.js), [server/routes/admin.routes.js](./server/routes/admin.routes.js), migration `202610140002`. Admin role checks are performed on server routes/services and verification/publication transitions are constrained.                                                                                                                                                       |
| Eligibility matching and age                                                                   | Implemented; domain coverage is partial                      | [server/services/matching/evaluate-vacancy.js](./server/services/matching/evaluate-vacancy.js), [shared/age.js](./shared/age.js). Cutoff-date age, explicit category relaxation, qualification, discipline, experience and state checks exist. Multiple simultaneous category relaxations, every recruitment-specific equivalency, and all notification edge cases are not represented; outcomes must remain preliminary/reviewable.                          |
| Email queue, reminders and unsubscribe                                                         | Implemented in code; provider delivery not verified here     | [server/services/notifications](./server/services/notifications), migration `202610140005`. Queue idempotency, retry/claim and unsubscribe token tests exist. Real Resend delivery and webhook configuration remain environment-dependent.                                                                                                                                                                                                                    |
| Candidate dashboard and application tracker                                                    | Implemented; expanded lifecycle is migration-gated           | [client/src/candidate/CandidateDashboard.tsx](./client/src/candidate/CandidateDashboard.tsx), [client/src/candidate/VacancyDetail.tsx](./client/src/candidate/VacancyDetail.tsx). Migration `202610150008` and `TRACKER_LIFECYCLE_ENABLED` are required for the expanded states/notes. Default is legacy mode to avoid querying columns before migration.                                                                                                     |
| Candidate matching profile completeness                                                        | Implemented; migration-gated                                 | [client/src/profile/ProfileWizard.tsx](./client/src/profile/ProfileWizard.tsx), [server/services/profile.service.js](./server/services/profile.service.js), [server/services/matching/match-persistence.service.js](./server/services/matching/match-persistence.service.js). Category, discipline and experience are optional, Zod-validated, private, and sent to matching only after migration `202610150009` plus `PROFILE_MATCHING_FIELDS_ENABLED=true`. |
| Automated vacancy ingestion                                                                    | Implemented with deliberately disabled live sources          | [server/services/ingestion](./server/services/ingestion), [client/src/admin/AdminReviewQueue.tsx](./client/src/admin/AdminReviewQueue.tsx). Extraction validation, duplicate/correction handling, dry-run and admin review are present. SSC and Employment News remain disabled pending access permission; no real-source compatibility is claimed.                                                                                                           |
| Tests, deployment and privacy                                                                  | Partially implemented                                        | Unit tests and deployment configs exist. Playwright flow requires disposable Supabase and fixture environment values and failed before performing the journey when they were absent. Privacy/account-deletion UI and server flow exist; full retention, deletion, live deployment and integration checks still need verification.                                                                                                                             |
| SEO, accessibility and mobile                                                                  | Partially implemented                                        | Public pages/tools use responsive components and metadata. A complete route-by-route accessibility/SEO audit and assistive-technology verification has not been run.                                                                                                                                                                                                                                                                                          |
| Calendar, planner, practice, Centre Buddy, groups, travel/budget, scam reporting, beginner hub | Missing or not implemented as a product module               | The current codebase does not provide these full modules. Defer Centre Buddy until privacy, moderation, reporting, retention and access controls are designed and tested.                                                                                                                                                                                                                                                                                     |

## Security and correctness findings

- Admin endpoints must retain their server-side role checks. Do not treat a
  frontend role flag as authorization.
- Supabase service-role and Resend/LLM credentials are server environment
  variables. `.env.example` contains placeholders only; do not copy real values
  into client configuration or logs.
- RLS owner policies exist for candidate-owned records in the migrations. A
  full live cross-user access test has not been run because no disposable
  Supabase test credentials were configured. The backend's service-role access
  means every user-facing service query must continue to scope by authenticated
  user ID.
- Notification queue idempotency has unit coverage. End-to-end duplicate
  delivery and provider failure/retry behavior still need a disposable
  integration environment.
- Age evaluation uses each vacancy's `age_cutoff_date`; missing or invalid age
  rules return an unknown/review result rather than asserting eligibility.
- Publication is guarded by verification transitions; ingestion only creates
  review drafts and does not auto-publish.
- Request schemas use Zod. New matching profile values are bounded and
  optional. Category and experience inputs are private and are used only for
  preliminary rule comparisons, not as proof of eligibility.
- Account deletion exists in code, but live deletion and provider-side retention
  behavior have not been integration-tested.

## Migration status

Versioned migrations currently present are `202610140001` through
`202610140007`, `202610150008_expand_candidate_tracker.sql`, and the new
`202610150009_profile_matching_inputs.sql`.

The database history on the user's main Supabase project was not queried. The
last two migration files are **not confirmed applied** to any database. The
profile fields in migration 009 are nullable and additive. Do not enable the
tracker lifecycle flag until migration 008 is applied to the intended database.
Do not enable `PROFILE_MATCHING_FIELDS_ENABLED` until migration 009 is applied.
Do not run migrations against production without reviewing the Supabase
migration history, taking the normal backup, and explicitly approving the
deployment.

## Prioritized next work

1. Apply migrations only through the project's reviewed deployment procedure;
   validate 008/009 against a disposable Supabase project first.
2. Run the candidate journey using a disposable E2E Supabase project; test
   owner isolation, admin denial, migration-gated tracker behavior and deletion.
3. Verify profile values flow from onboarding through persistence to matcher;
   review combined-category relaxation limitations and add further explicit
   rule modeling only with authoritative notification examples.
4. Add the P1 calendar and deadline reminders, with verified/unverified date
   status, timezone-safe dates, preference controls and idempotent delivery.
5. Address a11y/SEO route audit and split the main client bundle if practical.
6. Defer social/location features until privacy, abuse, moderation and deletion
   controls can be tested end to end.

## Validation record

Validated in this checkout after the compatibility and profile changes:

- `npm test`: 39 Node tests and 81 Vitest tests passed.
- `npm run build`: passed TypeScript and Vite production build; Vite warns that
  the main minified bundle exceeds 500 kB.
- `npm run lint`: passed with one existing Fast Refresh warning in
  `client/src/auth/AuthProvider.tsx`.

Playwright was not run in this validation pass. The previous attempt stopped at
its required-environment guard because disposable Supabase and fixture settings
were missing; it did not verify the candidate journey.
