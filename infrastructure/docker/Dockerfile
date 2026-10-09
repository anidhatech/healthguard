# syntax=docker/dockerfile:1.7
# HealthGuard images, built from the repository root:
#   tools: migrations and the demo seed (full workspace, dev dependencies)
#   api:   NestJS API and background worker (production dependencies only)
#   web:   Next.js standalone server
# DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 CI=true
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate \
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# --- dependencies (cached until a manifest or the lockfile changes) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/clinical/package.json packages/clinical/
COPY packages/ai/package.json packages/ai/
COPY tests/e2e/package.json tests/e2e/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- build -------------------------------------------------------------------
FROM deps AS build
COPY . .
# The web server forwards /api/* here; rewrites are fixed at build time.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
RUN pnpm --filter @healthguard/api db:generate \
  && pnpm turbo run build --filter=@healthguard/api... --filter=@healthguard/web... \
  && pnpm --filter @healthguard/api deploy --prod --legacy /out/api

# --- tools: prisma migrate deploy + seed ---------------------------------------
FROM build AS tools
WORKDIR /repo
CMD ["pnpm", "db:migrate"]

# --- api (and worker) ----------------------------------------------------------
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/main.js"]

# --- web -------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
