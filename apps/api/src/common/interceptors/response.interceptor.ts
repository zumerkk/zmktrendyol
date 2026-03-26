import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map, tap } from "rxjs/operators";
import { Request, Response } from "express";

/**
 * Response Transformer Interceptor
 * 
 * Wraps all successful responses in: { success: true, data: ..., timestamp }
 * Adds X-Response-Time header for performance monitoring.
 * Excludes Swagger and health endpoints from wrapping.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const startTime = Date.now();

    // Skip wrapping for Swagger docs and health ping
    const skipPaths = ["/api/docs", "/api/health/ping"];
    const shouldSkip = skipPaths.some((p) => request.url.startsWith(p));

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        response.setHeader("X-Response-Time", `${duration}ms`);
      }),
      map((data) => {
        if (shouldSkip) return data;

        // Don't double-wrap if already has success field
        if (data && typeof data === "object" && "success" in data) {
          return data;
        }

        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            duration: `${Date.now() - startTime}ms`,
          },
        };
      }),
    );
  }
}
