import {
  Controller, Get, Post, Body, Param, Query, UseGuards, Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { EFaturaService } from "./e-fatura.service";

@ApiTags("e-Fatura")
@Controller("e-fatura")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EFaturaController {
  constructor(private eFatura: EFaturaService) {}

  @Post("generate/:orderId")
  @ApiOperation({ summary: "Sipariş için e-fatura oluştur" })
  async generateInvoice(@Req() req: any, @Param("orderId") orderId: string) {
    return this.eFatura.generateInvoice(req.user.tenantId, orderId);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Tarih aralığı için toplu fatura" })
  async generateBulk(
    @Req() req: any,
    @Body() dto: { startDate: string; endDate: string },
  ) {
    return this.eFatura.generateBulkInvoices(req.user.tenantId, dto.startDate, dto.endDate);
  }

  @Get("summary")
  @ApiOperation({ summary: "Aylık fatura ve vergi özeti" })
  async getInvoiceSummary(
    @Req() req: any,
    @Query("month") month?: number,
    @Query("year") year?: number,
  ) {
    return this.eFatura.getInvoiceSummary(req.user.tenantId, month, year);
  }

  @Post("connect")
  @ApiOperation({ summary: "e-Fatura entegratörü bağla" })
  async connectIntegrator(@Req() req: any, @Body() dto: any) {
    return this.eFatura.connectIntegrator(req.user.tenantId, dto);
  }
}
