import { Module } from "@nestjs/common";
import { TrendyolService } from "./trendyol.service";
import { TrendyolController } from "./trendyol.controller";
import { ProductsService } from "./products/products.service";
import { OrdersService } from "./orders/orders.service";
import { InventoryService } from "./inventory/inventory.service";
import { FinanceService } from "./finance/finance.service";
import { ClaimsService } from "./claims/claims.service";
import { SyncSchedulerService } from "./sync-scheduler.service";

@Module({
  controllers: [TrendyolController],
  providers: [
    TrendyolService,
    ProductsService,
    OrdersService,
    InventoryService,
    FinanceService,
    ClaimsService,
    SyncSchedulerService,
  ],
  exports: [
    TrendyolService,
    ProductsService,
    OrdersService,
    InventoryService,
    FinanceService,
    ClaimsService,
    SyncSchedulerService,
  ],
})
export class TrendyolModule {}
