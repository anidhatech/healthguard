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
pnpm --filter @healthguard/api start:worker   # optional terminal 3: background worker
```

For live reload while coding, run `pnpm dev` instead of build + start.

### B5. Run the checks

```bash
pnpm lint
pnpm typecheck
pnpm test                # unit tests
pnpm test:integration    # API + PostgreSQL + Redis (resets healthguard_test)
pnpm test:e2e            # browser tests; needs the app running on :3000
```

The first `pnpm test:e2e` needs a browser: `pnpm --filter @healthguard/e2e exec playwright install chromium`.

---

## Step 5: Walk through the demo (about 8 minutes)

1. **Sign in as Ananya Rao (patient).** The app opens in Telugu, her saved language. The banner "DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE" is on every screen.
2. **Home → "since your last visit":** HbA1c 7.4 → 6.8 %, weight 74.2 → 72.9 kg, steps 5,200 → 7,100, adherence 92 % (166 of 180 doses). Each card says how it was calculated.
3. **Medicines:** the Metformin instruction in Telugu. Switch the language (top right) to Hindi or English: the sentence comes from reviewed templates, never from AI, with the same numbers.
4. **Privacy & consent:** her consents, and "Who looked at your data", including refused attempts.
5. **Sign out → Dr. Meera Sharma (doctor):** today's schedule shows Ananya at 10:30. Open her record and press **Generate AI summary**: every line has sources, the provider and prompt version are shown, and observations are labelled "for clinician review".
6. **Dr. Arjun Reddy** (More demo accounts): same clinic, not in Ananya's care. Opening her labs shows an explained denial (`NO_CARE_RELATIONSHIP`), which is audited.
7. **Dr. Sameer Khan** (another organization): Ananya does not exist for him (404).
8. **Kavya Iyer (organization admin):** counts, members and the audit trail, with no clinical data.
9. **Priya Nair (patient):** withdraw "AI-assisted summaries". Dr. Meera's next AI request for Priya is refused with `NO_AI_CONSENT`.

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
