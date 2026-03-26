import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ExtensionJobService {
    private readonly logger = new Logger(ExtensionJobService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Pushes a new job to the extension
     */
    async createJob(tenantId: string, type: string, payload: any) {
        return this.prisma.extensionJob.create({
            data: {
                tenantId,
                type,
                payload,
                status: 'pending',
            },
        });
    }

    /**
     * Fetches the oldest pending job for a specific tenant
     */
    async getNextJob(tenantId: string) {
        const job = await this.prisma.extensionJob.findFirst({
            where: { tenantId, status: 'pending' },
            orderBy: { createdAt: 'asc' },
        });

        if (!job) return null;

        // Mark as in progress so other extension instances don't pick it up
        return this.prisma.extensionJob.update({
            where: { id: job.id },
            data: { status: 'in_progress' },
        });
    }

    /**
     * Handle the result reported back by the extension
     */
    async handleJobResult(tenantId: string, jobId: string, resultData: any) {
        const job = await this.prisma.extensionJob.findUnique({
            where: { id: jobId },
        });

        if (!job || job.tenantId !== tenantId) {
            throw new Error('Job not found or unauthorized');
        }

        const updatedJob = await this.prisma.extensionJob.update({
            where: { id: jobId },
            data: {
                status: 'completed',
                result: resultData,
            },
        });

        // Delegate to specific processors based on job type
        if (job.type === 'STOCK_PROBE' && resultData.success) {
            await this.processStockProbeResult(job, resultData);
        }

        return updatedJob;
    }

    /**
     * Process a successful STOCK_PROBE result
     */
    private async processStockProbeResult(job: any, resultData: any) {
        const payload = job.payload as any;
        if (!payload.competitorProductId) return;

        // Ensure there is an active probe entry
        let probe = await this.prisma.stockProbe.findFirst({
            where: { competitorProductId: payload.competitorProductId, isActive: true }
        });

        if (!probe) return;

        // Calculate delta if possible
        const lastResult = await this.prisma.stockProbeResult.findFirst({
            where: { probeId: probe.id },
            orderBy: { time: 'desc' },
        });

        let delta: number | null = null;
        if (lastResult && lastResult.stockCount !== null && resultData.stockCount !== undefined) {
            delta = resultData.stockCount - lastResult.stockCount;
        }

        await this.prisma.stockProbeResult.create({
            data: {
                probeId: probe.id,
                stockCount: resultData.stockCount,
                isAvailable: resultData.isAvailable ?? true,
                deltaFromPrev: delta,
                method: 'cart_probe_extension',
                rawResponse: resultData,
            }
        });

        await this.prisma.stockProbe.update({
            where: { id: probe.id },
            data: { lastProbedAt: new Date() }
        });
    }
}
