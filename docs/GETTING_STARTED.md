# Getting started: step by step

> DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE

This guide takes you from nothing to the running demo on your own computer, then walks through the demo story. Pick **Route A (Docker)** if you just want to see it, or **Route B (host)** if you want to develop.

---

## Step 0: Get the code

**Option 1: clone from GitHub** (needs access to the private repository)

```bash
git clone https://github.com/anidhatech/healthguard.git
cd healthguard
```

**Option 2: from the zip file**

1. Unzip `healthguard.zip` into a folder, for example `~/projects/healthguard` (macOS/Linux) or `C:\projects\healthguard` (Windows).
2. Open a terminal in that folder (`cd ~/projects/healthguard`).

Windows users: use **PowerShell** or **Windows Terminal**; for Route B, WSL 2 (Ubuntu) is the smoothest path.

---

## Route A: Docker (about 10 minutes the first time)

### A1. Install Docker
- macOS / Windows: install **Docker Desktop** and start it (wait until it says "Engine running").
- Linux: install Docker Engine and the Compose plugin (`docker compose version` should work).

### A2. Create your `.env`
Easiest (needs Node.js 22+):

```bash
corepack enable
pnpm install
pnpm env:setup
```

Without Node.js: copy the example. The API then generates temporary sign-in keys at start-up, which is fine for a demo.

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

`.env` holds secrets. It is git-ignored; never commit or share it.

### A3. Start everything

```bash
docker compose up --build
```

The first build downloads base images and dependencies (a few minutes). You will see, in order: `postgres` and `redis` healthy → `migrate` exits 0 → `seed` prints "Hero numbers verified" → `api`, `worker`, `web` start.

### A4. Open the app
- App: **http://localhost:3000**
- API docs (Swagger): **http://localhost:4000/api/docs**
- Health: http://localhost:4000/health · Readiness: http://localhost:4000/ready

### A5. Stop, reset, clean up

```bash
docker compose down            # stop (data kept)
docker compose up              # start again; the seed resets the demo to day 92
docker compose down -v         # stop and delete the database volume
```

---

## Route B: run on your computer (for development)

### B1. Install the tools
- **Node.js 24** (or 22.12+): https://nodejs.org or `nvm install` (the repo has `.nvmrc`).
- **pnpm 10**: `corepack enable` (ships with Node.js).
- **PostgreSQL 17** (16 works) and **Redis 7**. The quickest way is to run just these two from the Compose file:

```bash
docker compose up -d postgres redis
```

  Or install them natively and create the role and databases:

```sql
CREATE ROLE healthguard LOGIN PASSWORD 'healthguard' CREATEDB;
CREATE DATABASE healthguard OWNER healthguard;
CREATE DATABASE healthguard_test OWNER healthguard;
```

### B2. Install dependencies and configure

```bash
pnpm install
pnpm env:setup           # writes .env with fresh JWT keys
```

Check `DATABASE_URL`, `TEST_DATABASE_URL` and `REDIS_URL` in `.env` match your setup.

### B3. Create the database and load the demo

```bash
pnpm db:generate         # generate the Prisma client
pnpm db:migrate          # create tables, triggers and constraints
pnpm db:seed             # synthetic demo; prints the verified hero numbers
```

### B4. Build and start

```bash
pnpm build
pnpm --filter @healthguard/api start      # terminal 1: API on http://localhost:4000
pnpm --filter @healthguard/web start      # terminal 2: web on http://localhost:3000
pnpm --filter @healthguard/api start:worker   # terminal 3: worker (reminders, missed doses)
```

For live reload while coding, run `pnpm dev` instead of build + start.

### B5. Run the checks

```bash
pnpm lint
pnpm typecheck
pnpm test                # unit tests
pnpm test:integration    # API + PostgreSQL + Redis (resets healthguard_test)
pnpm eval:ai             # AI safety evaluation
pnpm test:e2e            # browser tests; needs the app running on :3000
```

The first `pnpm test:e2e` needs a browser: `pnpm --filter @healthguard/e2e exec playwright install chromium`. The browser suite resets the demo data and signs in many times: start the API with `AUTH_RATE_LIMIT_PER_MINUTE=500` for it.

---

## Step 5: Walk through the demo (about 12 minutes)

Sign in as **Kavya Iyer (organization admin)**. The **Demo console** jumps the whole demo to a story day and sets the time of day. A reset signs everyone out.

**Day 0 — the visit** (console: reset to day 0, time 11:00)
1. **Dr. Meera Sharma** → open Ananya → **Prescribe** → Amoxicillin: the check shows her **penicillin allergy** and signing is blocked. Discard.
2. **Prescribe** → Metformin 500 mg, after breakfast +15 min, 90 days, "Blood sugar", note "Take with food" → **Save draft and run checks** → read the instruction in English, Hindi and Telugu (built from reviewed templates, never AI) → tick "I have read…" → **Sign**. Doses start the next day.

**Day 6 — first week** (reset to day 6, time 07:40)
3. **Ananya Rao** (opens in Telugu): today's doses, the reminder on the **simulated phone**, **Read aloud**. Tap **Taken** on Telmisartan, snooze Metformin 30 min.
4. **సహాయం కావాలి (Need help)**: 112 and 108 come first; then ask for a call-back about a side effect.
5. **Ravi Kumar (care coordinator)**: the request is in the **Care queue** → **Log call**.

**Day 42 — missed doses** (reset to day 42)
6. Ravi's care queue shows the call-back the rule raised after two missed doses in a row; Dr. Meera's patient list flags "Missed doses".

**Day 85 — new report** (reset to day 85)
7. Ananya → Tests: **check the values read from the report** against the paper. Before she confirms, they are shown but left out of trends and the AI summary.

**Day 88 — booking** (reset to day 88, time 18:00)
8. Ananya → Appointments → **Approve this time**. Ravi → open Ananya → **Confirm**. It can never be confirmed without her approval.

**Day 92 — follow-up visit** (reset to day 92)
9. Ananya's home: HbA1c 7.4 → 6.8 %, weight 74.2 → 72.9 kg, steps 5,200 → 7,100, adherence 92 % (166 of 180), with a sentence that says these moved together, **not** that one caused the other.
10. Dr. Meera → **Generate AI summary**: every line has sources; mark an observation **Noted** or **Dismiss** (audited, nothing clinical happens). **Download FHIR file** (tagged SYNTHETIC).
11. Ananya → Profile → **Health record link (ABDM)**: clearly labelled **SIMULATED — not connected to ABDM**; link and preview what would be shared. Nothing is sent.
12. Access control: **Dr. Arjun Reddy** gets an explained denial (`NO_CARE_RELATIONSHIP`); **Dr. Sameer Khan** (other organization) gets "not found"; **Priya Nair** can withdraw AI consent, after which AI requests for her are refused (`NO_AI_CONSENT`).

---

## Step 6 (optional): use Claude instead of the demo AI

1. Get an API key from the Anthropic Console.
2. In `.env`: `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=<your key>`.
3. Restart the API (`docker compose up -d api` or restart the process).
4. `GET /api/v1/ai/status` shows `"provider": "ANTHROPIC"` and `"anthropicKeyConfigured": true` (the key itself is never shown).

The same safety checks apply to live output. If Claude fails or its output is unsafe, the API falls back to the demo provider and labels the result "Fallback used".

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid configuration: DATABASE_URL` | Create `.env` (Step A2 / B2). |
| API exits: `DEMO_MODE in a production build requires ALLOW_DEMO_IN_PRODUCTION=true` | Intended safety check. Compose already sets it; on the host use `NODE_ENV=development`. |
| `/ready` returns 503 | PostgreSQL or Redis is not reachable; check `docker compose ps` and the URLs in `.env`. |
| Seed refuses to run | It needs `DEMO_MODE=true` and refuses if non-demo organizations exist (it would erase data). |
| Port 3000/4000/5432/6379 in use | Stop the other program or change `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`. |
| "Too many requests" when signing in | The sign-in rate limit is 20 per minute; wait a minute. |
| Prisma cannot download its engine | The first `db:migrate` downloads the schema engine; it needs internet access to `binaries.prisma.sh`. |
