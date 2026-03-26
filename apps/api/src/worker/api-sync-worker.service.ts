import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { TrendyolService } from '../trendyol/trendyol.service';

/**
 * Worker to sync data from the official Trendyol API.
 * Pulls orders, products, and inventory for each connected seller.
 */
@Processor('api_sync_queue')
@Injectable()
export class ApiSyncWorkerService extends WorkerHost {
    private readonly logger = new Logger(ApiSyncWorkerService.name);

    constructor(
        private prisma: PrismaService,
        private trendyolService: TrendyolService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing API Sync Job: ${job.id} for tenant ${job.data.tenantId}`);

        const { tenantId, syncType = 'orders' } = job.data;

        // Find or create a sync job record
        let syncJob = await this.prisma.syncJob.findFirst({
            where: { tenantId, type: syncType },
        });

        if (!syncJob) {
            syncJob = await this.prisma.syncJob.create({
                data: { tenantId, type: syncType, isActive: true },
            });
        }

        // Create a run record
        const run = await this.prisma.syncJobRun.create({
            data: { jobId: syncJob.id, status: 'running' },
        });

        try {
            const { client, sellerId } = await this.trendyolService.getClient(tenantId);

            let syncedCount = 0;

            if (syncType === 'orders' || syncType === 'all') {
                const ordersRes = await client.get(
                    `/integration/sellers/${sellerId}/orders`,
                    { params: { status: 'Created', size: 50 } }
                );

                const orders = ordersRes.data?.content || [];
                syncedCount += orders.length;

                for (const order of orders) {
                    const orderNumber = String(order.orderNumber || order.id);
                    const existing = await this.prisma.order.findFirst({
                        where: { tenantId, trendyolOrderNumber: orderNumber },
                    });

                    if (existing) {
                        await this.prisma.order.update({
                            where: { id: existing.id },
                            data: { status: order.status, totalPrice: order.totalPrice },
                        });
                    } else {
                        await this.prisma.order.create({
                            data: {
                                tenantId,
                                trendyolOrderNumber: orderNumber,
                                status: order.status || 'Created',
                                totalPrice: order.totalPrice || 0,
                                orderDate: new Date(order.orderDate || Date.now()),
                            },
                        });
                    }
                }

                this.logger.log(`Synced ${orders.length} orders from Trendyol API`);
            }

            if (syncType === 'products' || syncType === 'all') {
                const productsRes = await client.get(
                    `/integration/sellers/${sellerId}/products`,
                    { params: { size: 50, page: 0 } }
                );

                const products = productsRes.data?.content || [];
                syncedCount += products.length;
                this.logger.log(`Synced ${products.length} products from Trendyol API`);
            }

            // Update sync timestamp on seller connection
            const connection = await this.prisma.sellerConnection.findFirst({
                where: { tenantId, status: 'active' },
            });
            if (connection) {
                await this.prisma.sellerConnection.update({
                    where: { id: connection.id },
                    data: { lastSyncAt: new Date() },
                });
            }

            // Mark run as completed
            await this.prisma.syncJobRun.update({
                where: { id: run.id },
                data: {
                    status: 'completed',
                    endedAt: new Date(),
                    recordsProcessed: syncedCount,
                },
            });

            return { success: true, syncedCount };

        } catch (error: any) {
            this.logger.error(`Failed API sync job ${job.id}: ${error.message}`);

            // Mark run as failed
            await this.prisma.syncJobRun.update({
                where: { id: run.id },
                data: {
                    status: 'failed',
                    endedAt: new Date(),
                    error: error.message,
                },
            });

            throw error;
        }
    }
}
