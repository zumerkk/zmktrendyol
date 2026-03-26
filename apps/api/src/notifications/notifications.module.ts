import { Module, Global } from "@nestjs/common";
import { NotificationsGateway } from "./notifications.gateway";
import { SmartReportingService } from "./smart-reporting.service";

@Global()
@Module({
  providers: [NotificationsGateway, SmartReportingService],
  exports: [NotificationsGateway, SmartReportingService],
})
export class NotificationsModule {}
