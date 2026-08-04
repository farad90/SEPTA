# ⚠️ Debian slim (نه Alpine) — Puppeteer از یک Chrome لینک‌شده به glibc استفاده می‌کنه
# که روی Alpine (musl libc) اصلاً اجرا نمی‌شه، صرف‌نظر از هر کتابخانه‌ای که نصب بشه.
# پکیج‌های زیر دقیقاً همون‌هایی هستن که مستندات رسمی Puppeteer برای Headless Chrome
# روی Debian/Ubuntu لازم می‌دونه (صفحه Troubleshooting پروژه).
FROM node:18-slim AS base
# ⚠️ Chrome از طریق apt (chromium سیستمی) نصب می‌شه، نه دانلود خودکار Puppeteer —
# storage.googleapis.com/chrome-for-testing-public مکرراً برای IP های دیتاسنتر/VPS با
# 403 رد می‌کنه (روی چند IP و چند شبکه مختلف تکرار شد، پس Retry حلش نمی‌کنه)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation chromium \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter api... --filter web

FROM deps AS build
COPY . .
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api run build

FROM base AS runtime
# P1-E1-F2-T2 — bake the commit SHA into the image so `docker inspect` can always
# answer "what's actually running", instead of deploys being untraceable tar/scp copies.
ARG GIT_COMMIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT_SHA
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
