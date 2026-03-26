import { Module } from "@nestjs/common";
import { EFaturaService } from "./e-fatura.service";
import { EFaturaController } from "./e-fatura.controller";

@Module({
  controllers: [EFaturaController],
  providers: [EFaturaService],
  exports: [EFaturaService],
})
export class FinanceModule {}
