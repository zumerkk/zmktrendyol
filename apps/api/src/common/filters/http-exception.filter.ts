import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";

/**
 * Global Exception Filter
 * 
 * Catches all unhandled errors and returns a consistent error response format.
 * Handles: HttpException, Prisma errors, generic JavaScript errors.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Sunucu hatası oluştu";
    let code = "INTERNAL_ERROR";
    let details: any = undefined;

    // ─── NestJS HttpException ───────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();

      if (typeof responseBody === "string") {
        message = responseBody;
      } else if (typeof responseBody === "object") {
        const body = responseBody as any;
        message = body.message || exception.message;
        details = body.error;
      }

      code = this.getErrorCode(status);
    }
    // ─── Prisma Errors ──────────────────────────
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2002":
          status = HttpStatus.CONFLICT;
          code = "DUPLICATE_ENTRY";
          message = "Bu kayıt zaten mevcut";
          details = { field: (exception.meta as any)?.target };
          break;
        case "P2025":
          status = HttpStatus.NOT_FOUND;
          code = "NOT_FOUND";
          message = "Kayıt bulunamadı";
          break;
        case "P2003":
          status = HttpStatus.BAD_REQUEST;
          code = "FOREIGN_KEY_ERROR";
          message = "İlişkili kayıt bulunamadı";
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          code = "DATABASE_ERROR";
          message = "Veritabanı hatası";
      }
    }
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = "VALIDATION_ERROR";
      message = "Geçersiz veri formatı";
    }
    // ─── Generic Error ──────────────────────────
    else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log server errors with stack trace
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} → ${status}: ${message}`);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message: Array.isArray(message) ? message : [message].flat(),
        ...(details && { details }),
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      429: "RATE_LIMITED",
      500: "INTERNAL_ERROR",
    };
    return codeMap[status] || `HTTP_${status}`;
  }
}
