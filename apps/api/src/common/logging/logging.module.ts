import { randomUUID } from "crypto";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

// P1-E2-F2-T2 — replaces the default NestJS Logger with structured JSON logs
// (nestjs-pino), and gives every log line inside a request the same
// correlation ID (nestjs-pino binds request data to logs automatically via
// AsyncLocalStorage — no manual plumbing needed in every service). Forwards
// an incoming X-Request-Id header if the caller already set one (useful once
// this API sits behind a reverse proxy that generates its own), otherwise
// generates a fresh UUID and echoes it back on the response so a client can
// reference it when reporting a problem.
//
// Wiring the same ID into a global exception filter's error response is
// deferred — apps/api/src/common/filters/all-exceptions.filter.ts doesn't
// exist yet (that's P0-E4-F2-T2, a Phase 0 task not executed in this pass).
// Once it lands, read req.id off the request inside the filter and include
// it in the error body the same way this module already includes it in
// every log line.
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const incoming = req.headers["x-request-id"];
          const id = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
          res.setHeader("X-Request-Id", id);
          return id;
        },
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        // Pretty, colorized, human-readable output locally; plain JSON in
        // production so it's parseable by a log aggregator (Loki, etc. — see
        // the DevOps roadmap's centralized-logging task).
        transport:
          process.env.NODE_ENV === "production"
            ? undefined
            : { target: "pino-pretty", options: { singleLine: true, colorize: true, ignore: "pid,hostname" } },
        // Never let a login/refresh request's Authorization header, session
        // cookie, or Set-Cookie response header end up in a log line.
        redact: {
          paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
          censor: "**REDACTED**",
        },
      },
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
