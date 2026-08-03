FROM node:18-slim AS build
RUN corepack enable
WORKDIR /app
# ⚠️ pnpm --filter محدودیت روی symlink می‌ذاره ولی برای هماهنگی با یک lockfile واحد
# monorepo، postinstall پکیج‌های سایر پروژه‌ها (مثل puppeteer در apps/api) رو هم اجرا
# می‌کنه؛ چون این Image اصلاً به Chrome نیاز نداره، دانلودش رو کامل غیرفعال می‌کنیم
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter web...
COPY . .
# پیش‌فرض /api — یعنی همون Origin که خود سایت روش سرو می‌شه (بدون نیاز به دامنه/IP هاردکد)
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter web run build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
