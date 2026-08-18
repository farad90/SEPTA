import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  // bufferLogs holds Nest's startup logs until the pino Logger below is
  // ready, instead of emitting them through the default logger first —
  // otherwise bootstrap logs would look different (and lack request-ID
  // support) from every log line the app emits afterward.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);

  // P1-E4-F3-T3 — no security headers existed anywhere before this. Two
  // defaults deliberately overridden from helmet's document-oriented
  // defaults, both for the same underlying reason: this is a JSON API
  // consumed cross-origin by a separately-served frontend (different ports
  // in local dev; same origin behind nginx in production, per nginx.conf).
  //   - contentSecurityPolicy: CSP governs how an HTML *document* loads
  //     resources — irrelevant to JSON responses, and risks unexpected
  //     interference with the PDF-preview <iframe> in the frontend's
  //     FileViewer component. The frontend's own document (served by
  //     nginx, see apps/web/nginx.conf) is where CSP actually belongs.
  //   - crossOriginResourcePolicy: defaults to same-origin, which would
  //     make browsers block this API's responses from being read
  //     cross-origin regardless of CORS — breaking local dev (web on
  //     :5173 fetching from api on :3000) outright. Access control here is
  //     already CORS's job (configured below); this header would just
  //     duplicate-and-conflict with it.
  // Everything else — HSTS, X-Frame-Options (SAMEORIGIN), X-Content-Type-
  // Options (nosniff, genuinely relevant for uploaded-file downloads),
  // Referrer-Policy, etc. — stays at helmet's default.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // CORS_ORIGIN می‌تونه چند origin با کاما باشه؛ خارج از production هر پورت localhost هم مجازه
  // (Vite در dev ممکنه پورت آزاد بعدی رو برداره — بدون این، هر تغییر پورت نیاز به ویرایش .env داشت)
  const allowedOrigins = (config.get<string>("CORS_ORIGIN") ?? "").split(",").map((o) => o.trim());
  const isProduction = process.env.NODE_ENV === "production";
  app.enableCors({
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        (!isProduction && /^http:\/\/localhost:\d+$/.test(origin));
      callback(null, allowed);
    },
    credentials: true,
  });

  const port = config.get<number>("PORT") ?? 3000;
  await app.listen(port);
}

bootstrap();
