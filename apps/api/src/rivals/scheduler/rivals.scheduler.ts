import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RivalsService } from '../rivals.service';

@Injectable()
export class RivalsScheduler {
  private readonly logger = new Logger(RivalsScheduler.name);
  private running = false;

  constructor(private prisma: PrismaService, private rivals: RivalsService) {}

  @Cron('*/15 * * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const targets = await this.prisma.rivalWatchTarget.findMany({
        where: { isActive: true },
        select: { id: true, tenantId: true, scanIntervalMinutes: true, lastScanAt: true },
        take: 200,
      });

      for (const t of targets) {
        const last = t.lastScanAt ? t.lastScanAt.getTime() : 0;
        const due = Date.now() - last >= (t.scanIntervalMinutes || 15) * 60_000;
        if (!due) continue;

        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 1500)));
        try {
          await this.rivals.scanTargetNow(t.tenantId, t.id);
        } catch (e: any) {
          this.logger.warn(`scan failed target=${t.id}: ${e?.message || e}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
