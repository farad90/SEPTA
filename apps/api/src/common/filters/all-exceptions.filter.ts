import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "../../../generated/prisma";

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  requestId?: string;
}

/**
 * P0-E4-F2-T2 — there was no global exception filter anywhere; anything
 * unhandled (a raw Prisma error not already caught by the specific service
 * that ran the query, a genuine bug) fell through to Nest's default handler
 * with an inconsistent shape and, for unexpected errors, a real risk of
 * leaking internal detail (stack traces, file paths) to the client.
 *
 * This is a safety net, not a replacement for the specific, more helpful
 * error handling several services already do locally (e.g. catching P2002
 * to say "this item code is already in use" instead of a generic message —
 * see order.service.ts, po.service.ts, settlement.service.ts, and the HR
 * *-types services for P2003). Those keep running exactly as before; this
 * filter only ever sees what they didn't already catch and convert to an
 * HttpException themselves.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    // Set by nestjs-pino's genReqId (see LoggingModule) — either forwarded
    // from an incoming X-Request-Id header or a freshly generated UUID.
    const requestId = (request as unknown as { id?: string }).id;

    const { statusCode, message, logLevel } = this.resolve(exception);

    const body: ErrorResponseBody = { statusCode, message };
    if (requestId) {
      body.requestId = requestId;
    }

    if (logLevel === "error") {
      // Full detail (stack included) goes to the server log only, tagged
      // with the same correlation ID that's in the response — that's the
      // ID a user can hand back when reporting "something went wrong".
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${this.describe(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode}: ${message}`);
    }

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): { statusCode: number; message: string; logLevel: "warn" | "error" } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message = typeof res === "string" ? res : ((res as { message?: string }).message ?? exception.message);
      return { statusCode: exception.getStatus(), message, logLevel: "warn" };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    // Genuinely unexpected — a real bug, not a validation/business-rule
    // rejection. Never echo exception.message to the client here: for a
    // non-HttpException error there's no guarantee it's safe to expose.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "خطای غیرمنتظره‌ای رخ داد. لطفاً کد پیگیری رو به تیم فنی گزارش بدید.",
      logLevel: "error",
    };
  }

  private resolvePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): { statusCode: number; message: string; logLevel: "warn" | "error" } {
    switch (exception.code) {
      case "P2002": // unique constraint
        return {
          statusCode: new ConflictException().getStatus(),
          message: "این مقدار تکراریه — قبلاً برای رکورد دیگه‌ای ثبت شده",
          logLevel: "warn",
        };
      case "P2003": // foreign key constraint
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: "این عملیات به یک رکورد وابسته اشاره می‌کنه که وجود نداره یا قابل حذف نیست",
          logLevel: "warn",
        };
      case "P2025": // record not found (update/delete target)
        return { statusCode: new NotFoundException().getStatus(), message: "رکورد مورد نظر یافت نشد", logLevel: "warn" };
      default:
        // Unrecognized Prisma error code — treat as unexpected/server-side,
        // log full detail, don't guess at a client-safe message.
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "خطای غیرمنتظره‌ای در دیتابیس رخ داد. لطفاً کد پیگیری رو به تیم فنی گزارش بدید.",
          logLevel: "error",
        };
    }
  }

  private describe(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.message;
    }
    try {
      return JSON.stringify(exception);
    } catch {
      return String(exception);
    }
  }
}
