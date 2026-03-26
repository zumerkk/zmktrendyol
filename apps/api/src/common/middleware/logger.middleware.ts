import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

/**
 * Request Logger Middleware
 * 
 * Structured request/response logging with color-coded status.
 * Logs: method, path, status, response time, content length.
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    // Skip noisy endpoints
    const skipPaths = ["/api/health/ping", "/favicon.ico"];
    if (skipPaths.some((p) => req.url.startsWith(p))) {
      return next();
    }

    const startTime = Date.now();
    const { method, originalUrl } = req;

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get("content-length") || "-";

      const logMessage = `${method} ${originalUrl} → ${statusCode} (${duration}ms, ${contentLength}B)`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
