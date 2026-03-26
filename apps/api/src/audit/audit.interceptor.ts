import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AuditService } from "./audit.service";

/**
 * Global Audit Interceptor
 * Automatically logs all POST/PUT/DELETE requests
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutating requests
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next.handle();
    }

    const user = request.user;
    if (!user) return next.handle();

    const startTime = Date.now();
    const path = request.route?.path || request.url;

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          this.auditService
            .log({
              tenantId: user.tenantId,
              userId: user.id,
              action: `${method} ${path}`,
              entityType: this.extractEntityType(path),
              entityId: request.params?.id,
              beforeValue:
                method === "PUT" || method === "PATCH"
                  ? request.body
                  : undefined,
              afterValue: responseBody,
              ipAddress: request.ip || request.headers?.["x-forwarded-for"],
            })
            .catch((err) =>
              this.logger.error(`Audit log failed: ${err.message}`),
            );
        },
        error: (error) => {
          this.auditService
            .log({
              tenantId: user.tenantId,
              userId: user.id,
              action: `${method} ${path} [ERROR]`,
              entityType: this.extractEntityType(path),
              entityId: request.params?.id,
              afterValue: { error: error.message },
              ipAddress: request.ip,
            })
            .catch((err) =>
              this.logger.error(`Audit log failed: ${err.message}`),
            );
        },
      }),
    );
  }

  private extractEntityType(path: string): string {
    const segments = path.split("/").filter(Boolean);
    // e.g., /api/trendyol/products → "products"
    return segments[segments.length - 1] || "unknown";
  }
}
