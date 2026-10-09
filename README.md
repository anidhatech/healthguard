# HealthGuard

> **DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE**
>
> HealthGuard is a software demonstration. It is not a medical device, not a clinical decision-support system, and not ABDM certified or production compliant. It does not diagnose, prescribe or change treatment. All clinical decisions stay with qualified healthcare professionals. Every person and record in it is fictional.

HealthGuard brings a patient's health story into one place (visits, conditions, medicines, lab trends, activity, adherence) for patients, clinicians and clinics. This repository is the **Phase 1 foundation**: a working multi-tenant platform with a seeded demo story, consent-aware access control, an audited AI summary, and a three-language patient app.

Step-by-step setup: **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)**.

---

## 1. What works today

| Area                | Built in this phase                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patients            | Dashboard with "since your last visit" (HbA1c, weight, steps, adherence), medicines with reviewed instructions in English, Hindi or Telugu, timeline, lab trends, records, activity and vitals, appointments, consent with withdraw, "who saw my data", notifications, profile and language |
| Clinicians          | Day schedule, my patients / all patients, patient workspace (progress, labs, medicines and adherence, history, timeline), AI pre-visit summary with sources                                                                                                                                 |
| Organization admins | Counts, members and roles, audit trail. No clinical data                                                                                                                                                                                                                                    |
| Platform admins     | Tenant list (counts only)                                                                                                                                                                                                                                                                   |
| Platform            | Multi-tenancy, consent-aware access decisions, append-only audit, rate limits, CSRF, problem-details errors, Swagger, health and readiness checks, background worker                                                                                                                        |

Anything not built is shown as a disabled control labelled **"Coming in next phase"** (for example "Mark today's dose as taken", "Upload a report", "Write or change a prescription", "Link ABHA"). Nothing pretends to work.

## 2. Architecture at a glance

```text
Browser (PWA) ──► Next.js web (:3000) ──/api/*──► NestJS API (:4000) ──► PostgreSQL 17
                                                        │                └ Prisma 7 (tenant-scoped client)
                                                        ├──► Redis 7 (rate limits, queues)
                                                        ├──► AI provider: Demo (default) or Claude
                                                        └──► Worker (BullMQ): consent expiry
```

- The browser only talks to the web origin; Next.js forwards `/api/*` to the API, so session cookies are first-party.
- Every rule that protects data runs in the API: role policy, tenant scoping, consent, care relationship. The web app never filters data on its own.
- Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/AI_AGENT_SPEC.md](docs/AI_AGENT_SPEC.md).

## 3. Repository structure

```text
apps/
  api/                 NestJS 12 API (ESM) + Prisma 7 + BullMQ worker
    prisma/            schema.prisma (32 models), migrations, deterministic demo seed
    src/modules/       auth, organizations, patients, clinicians, encounters, records,
                       medications, adherence, labs, activity, appointments, follow-ups,
                       consent, audit, notifications, ai, interoperability, files, health, demo
    test/              integration tests (real PostgreSQL + Redis)
  web/                 Next.js 16 PWA (App Router, Tailwind 4, next-intl, TanStack Query)
    messages/          en-IN, hi-IN, te-IN UI catalogues
packages/
  shared/              zod API contracts, roles, enums, locales, demo accounts
  clinical/            deterministic calculations: adherence, averages, dose times,
                       template-rendered medication instructions (en/hi/te)
  ai/                  AIProvider abstraction, ClaudeProvider, DemoAIProvider, prompt
                       registry, request gate, output safety validation, orchestrator
  config/              shared TypeScript and ESLint presets
tests/e2e/             Playwright browser tests
infrastructure/docker/ Dockerfile (tools / api / web targets), Postgres init
docs/                  PRD, architecture, data model, AI spec, security, FHIR, ABDM, roadmap
compose.yaml           laptop demo stack
```

## 4. Prerequisites

- **Docker route:** Docker Desktop (or Docker Engine) with Compose v2.
- **Host route:** Node.js 22.12+ (24 recommended, see `.nvmrc`), pnpm 10 (`corepack enable`), PostgreSQL 17 (16 works), Redis 7.

## 5. Quick start with Docker

```bash
git clone https://github.com/anidhatech/healthguard.git
cd healthguard
corepack enable && pnpm install   # only needed for env:setup; or: cp .env.example .env
pnpm env:setup                    # creates .env with fresh JWT keys (never committed)
docker compose up --build
```

Open **http://localhost:3000** and choose a demo account. Swagger: **http://localhost:4000/api/docs**.

Compose starts PostgreSQL, Redis, runs migrations, seeds the demo (resetting it to scenario day 92 on every `up`), then starts the API, the worker and the web app.

## 6. Run on the host (without Docker)

```bash
pnpm install
pnpm env:setup                    # then edit DATABASE_URL / REDIS_URL in .env if needed
pnpm db:generate                  # Prisma client
pnpm db:migrate                   # apply migrations
pnpm db:seed                      # load the synthetic demo (needs DEMO_MODE=true)
pnpm build                        # builds packages, API and web
pnpm --filter @healthguard/api start      # API on :4000
pnpm --filter @healthguard/web start      # web on :3000 (second terminal)
```

For development with reload: `pnpm dev` (runs the API and the web app in watch mode).

## 7. Environment variables

All configuration lives in `.env` (copy of [`.env.example`](.env.example)). `.env` is git-ignored and must never be committed. The API validates every variable at start-up and refuses to start with an unsafe combination (for example demo mode in a production build without `ALLOW_DEMO_IN_PRODUCTION=true`, or production without JWT keys).

| Variable                                                                          | Purpose                                                              |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`, `TEST_DATABASE_URL`                                               | PostgreSQL (the integration tests reset the test database)           |
| `REDIS_URL`                                                                       | Rate limits and queues                                               |
| `DEMO_MODE`, `DEMO_AUTH_ENABLED`, `DEMO_ACCOUNT_PASSWORD`                         | Demo banner, quick sign-in, seed password                            |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`                                               | Ed25519 key pair for access tokens (`pnpm env:setup` generates them) |
| `AI_PROVIDER`                                                                     | `demo` (default, offline) or `anthropic`                             |
| `ANTHROPIC_API_KEY`                                                               | Read from the environment only; never hardcoded, logged or returned  |
| `AI_MODEL`, `AI_FAST_MODEL`, `AI_FALLBACK_TO_DEMO`                                | Model choice and fallback                                            |
| `APP_BASE_URL`, `API_PUBLIC_URL`, `API_INTERNAL_URL`, `CORS_ORIGINS`              | URLs                                                                 |
| `RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_PER_MINUTE`, `AI_RATE_LIMIT_PER_MINUTE` | Rate limits                                                          |
| `LOG_LEVEL`, `LOG_PRETTY`                                                         | Structured logging (pino); credentials and cookies are redacted      |
| `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`                                             | Reserved for document upload (next phase)                            |

## 8. Demo accounts

> **DEMO / DEVELOPMENT AUTHENTICATION.** Quick sign-in lets you pick a synthetic account without a password. It is not identity verification and is disabled unless `DEMO_MODE=true`. The same accounts also accept email + `DEMO_ACCOUNT_PASSWORD` (default `HealthGuard-Demo-2026`) through the normal password sign-in, which locks after 5 failures.

| Account                            | Person           | Role                           | Shows                                               |
| ---------------------------------- | ---------------- | ------------------------------ | --------------------------------------------------- |
| `patient@healthguard.demo`         | Ananya Rao       | Patient                        | The hero story; prefers Telugu                      |
| `doctor@healthguard.demo`          | Dr. Meera Sharma | Doctor                         | Ananya's primary clinician; AI brief                |
| `admin@healthguard.demo`           | Kavya Iyer       | Organization admin             | Counts and audit, no clinical data                  |
| `arjun.reddy@healthguard.demo`     | Dr. Arjun Reddy  | Doctor                         | Same clinic, not in Ananya's care: explained denial |
| `care@healthguard.demo`            | Ravi Kumar       | Care team (care coordinator)   | Adherence and appointments, not labs                |
| `rahul.mehta@healthguard.demo`     | Rahul Mehta      | Patient                        | Hindi; no AI consent                                |
| `priya.nair@healthguard.demo`      | Priya Nair       | Patient                        | Short history; can withdraw AI consent              |
| `platform@healthguard.demo`        | Platform Admin   | Platform admin                 | Tenant list only                                    |
| `lakeview.doctor@healthguard.demo` | Dr. Sameer Khan  | Doctor at another organization | Tenant isolation (sees "not found")                 |

## 9. The seeded demo story

The seed (`apps/api/prisma/seed`) is deterministic: same IDs and numbers every run. Day 0 (8 Jul 2026) is Ananya's last visit; the demo clock stands on **day 92 (8 Oct 2026)**, her follow-up. After seeding it re-measures the hero numbers with the same code the API uses and fails if any differ:

| Measure                       | Before (day 0) | Now (day 92)            |
| ----------------------------- | -------------- | ----------------------- |
| HbA1c                         | 7.4 %          | 6.8 %                   |
| Weight                        | 74.2 kg        | 72.9 kg                 |
| Average daily steps (30 days) | 5,200          | 7,100                   |
| Recorded adherence            | —              | 92 % (166 of 180 doses) |

Metformin 500 mg and Telmisartan 40 mg are real generic medicines used for realism in a **synthetic** plan; every plan carries a "not a prescription" notice. Organizations: _HealthGuard Demo Medical Center_ and _Lakeview Demo Hospital_.

## 10. Roles, tenancy and access

- Roles: `PATIENT`, `DOCTOR`, `CARE_TEAM` (role group for `NURSE` and `CARE_COORDINATOR`), `ORG_ADMIN`, `PLATFORM_ADMIN` (plus `FRONT_DESK`, `AUDITOR`).
- **Tenant isolation is enforced in the database query**, not the UI: `prisma.tenant(orgId)` adds the organization to every read and rejects writes for another tenant. Patients of another organization return **404**, so their existence is not revealed.
- Every patient-data request goes through one access decision: self → tenant → role policy → consent → care relationship. Allowed and refused decisions are both written to the append-only audit table (database triggers reject updates and deletes), and patients see them under "Who looked at your data".
- Sessions: Ed25519-signed access token (15 min, httpOnly cookie) + rotating refresh token (stored hashed; reuse revokes the session) + double-submit CSRF token.

## 11. AI

- `AIProvider` abstraction with **`DemoAIProvider`** (default: deterministic, offline, no key) and **`ClaudeProvider`** (Anthropic Messages API with structured JSON output). Set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in `.env` to use Claude; any provider failure or unsafe output falls back to the demo provider and says so.
- Only one task runs in this phase: **`DOCTOR_BRIEF_SYNTHESIS`**, a pre-visit summary for doctors in the patient's care, with an active `AI_ASSISTANCE` consent from the patient.
- The model sees only a numbered fact sheet (no names, phone numbers or record numbers). Every sentence must cite facts; numbers not in the cited facts are removed; the result is labelled **"AI summary · check sources"** with provider, model, prompt version and confidence.
- **Refused before any data is read:** diagnose, prescribe, change dose, change frequency, change route, stop medication, approve treatment, book appointments, autonomous decisions, including when phrased inside an instruction (English, Hindi and Telugu patterns).
- **Blocked after generation:** treatment instructions, causal claims, diagnostic statements, false reassurance, identifiers.
- Every run is stored as an immutable `AIInteraction` with prompt hash, input hash, validation report and `SourceProvenance` links. Medication instructions are never AI-written: they come from reviewed templates.

## 12. API

- Base path `/api/v1`; `/health` (liveness) and `/ready` (PostgreSQL + Redis) at the root.
- Swagger UI: `/api/docs`; OpenAPI JSON: `/api/docs/openapi.json`.
- Every success is `{ data, meta }` (`meta.requestId`, `meta.synthetic`, `meta.dataNotice`); every error is RFC 9457 `application/problem+json` with a stable `code` and the request ID.
- Request IDs (`X-Request-Id`), `Cache-Control: no-store`, security headers (helmet), CORS allow-list, rate limits (general, sign-in, AI).

## 13. Tests and quality gate

```bash
pnpm lint && pnpm typecheck && pnpm test   # unit tests: shared, clinical, ai, api, web
pnpm test:integration                      # API against PostgreSQL + Redis (resets TEST_DATABASE_URL)
pnpm build                                 # production builds
pnpm test:e2e                              # Playwright, against a running stack on :3000
```

Integration tests cover: app start, database connectivity, health and readiness, authentication (cookies, refresh-token rotation, CSRF, logout), role authorization, organization isolation, patient access, doctor access, cross-tenant rejection, the demo AI provider, unsafe AI rejection, consent withdrawal, and the database's append-only and immutability rules.

The sign-in rate limit (20 per minute) is real: running the browser suite several times within a minute can hit it.

## 14. Known limitations (Phase 1)

- Demo authentication only; no OIDC, MFA or real identity verification.
- No dose answering, prescription writing, appointment booking, document upload or AI extraction yet (shown as "Coming in next phase").
- Reminders and notifications are in-app records only; nothing is sent by SMS, WhatsApp, email or push.
- FHIR export, ABDM sandbox and wearable sync are designed ([FHIR_MAPPING](docs/FHIR_MAPPING.md), [ABDM_INTEGRATION](docs/ABDM_INTEGRATION.md)) but not connected. HealthGuard is not ABDM certified.
- Metric labels and clinical names from the API are English; UI chrome and medication instructions are translated.
- Not load-tested, pen-tested or reviewed for regulatory compliance.

## 15. Roadmap and documents

Next phases are in [docs/ROADMAP.md](docs/ROADMAP.md). Product requirements: [docs/PRD.md](docs/PRD.md).

---

DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE
