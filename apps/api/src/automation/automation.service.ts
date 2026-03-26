import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActionableInsight } from '@prisma/client';

@Injectable()
export class AutomationService {
    private readonly logger = new Logger(AutomationService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Create a new automation rule
     */
    async createRule(tenantId: string, ruleData: any) {
        return this.prisma.automationRule.create({
            data: {
                tenantId,
                name: ruleData.name,
                description: ruleData.description,
                isActive: ruleData.isActive ?? true,
                triggerType: ruleData.triggerType,
                conditions: ruleData.conditions,
                actionType: ruleData.actionType,
                actionData: ruleData.actionData,
            },
        });
    }

    /**
     * List automation rules
     */
    async getRules(tenantId: string) {
        return this.prisma.automationRule.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Toggle rule active state
     */
    async toggleRule(tenantId: string, ruleId: string, isActive: boolean) {
        return this.prisma.automationRule.update({
            where: { id: ruleId, tenantId },
            data: { isActive },
        });
    }

    /**
     * Evaluate all active rules for all tenants (typically called by a Worker/Cron)
     */
    async evaluateAllRules() {
        this.logger.log('Evaluating all active automation rules...');
        const rules = await this.prisma.automationRule.findMany({
            where: { isActive: true },
        });

        for (const rule of rules) {
            try {
                await this.evaluateRule(rule);
            } catch (err: any) {
                this.logger.error(`Failed to evaluate rule ${rule.id}: ${err.message}`);
            }
        }
    }

    /**
     * Evaluate a single rule
     */
    private async evaluateRule(rule: any) {
        let triggered = false;

        // 1. Check IF condition
        switch (rule.triggerType) {
            case 'ACOS_ABOVE_THRESHOLD':
                triggered = await this.checkAcosCondition(rule);
                break;
            case 'COMPETITOR_PRICE_DROP':
                triggered = await this.checkCompetitorPriceCondition(rule);
                break;
            case 'PROFIT_MARGIN_LOW':
                triggered = await this.checkProfitMarginCondition(rule);
                break;
            default:
                this.logger.warn(`Unknown trigger type: ${rule.triggerType}`);
        }

        // 2. Perform THEN action
        if (triggered) {
            this.logger.log(`Rule ${rule.id} [${rule.name}] triggered! Executing action: ${rule.actionType}`);
            await this.executeAction(rule);

            // Update last triggered time
            await this.prisma.automationRule.update({
                where: { id: rule.id },
                data: { lastTriggeredAt: new Date() },
            });
        }
    }

    // --- Conditions ---

    private async checkAcosCondition(rule: any): Promise<boolean> {
        const { threshold } = rule.conditions as any;
        // Mock logic: Typically we would query the AdCampaign or KpiSkuDaily tables 
        // to find products where ACOS is > threshold over the last 7 days.
        // We simulate true 20% of the time for demo.
        return Math.random() < 0.2;
    }

    private async checkCompetitorPriceCondition(rule: any): Promise<boolean> {
        // Similar dynamic logic against StockProbeResult / PricingRule insights
        return Math.random() < 0.2;
    }

    private async checkProfitMarginCondition(rule: any): Promise<boolean> {
        // Queries Product profitability and KpiSkuDaily to check net margin
        return Math.random() < 0.2;
    }

    // --- Actions ---

    private async executeAction(rule: any) {
        switch (rule.actionType) {
            case 'DECREASE_AD_BUDGET':
                const { percent } = rule.actionData as any;
                this.logger.debug(`Decreasing ad budget by %${percent} for tenant ${rule.tenantId} due to rule ${rule.id}`);
                // Action logic: e.g. Call external Ads API Service
                break;
            case 'MATCH_PRICE':
                this.logger.debug(`Matching price for tenant ${rule.tenantId} due to rule ${rule.id}`);
                break;
            case 'PAUSE_ADS':
                this.logger.debug(`Pausing ads for tenant ${rule.tenantId} due to rule ${rule.id}`);
                break;
            default:
                this.logger.warn(`Unknown action type: ${rule.actionType}`);
        }

        // Log this action as an Insight or Audit event so user knows the AI did something
        await this.prisma.actionableInsight.create({
            data: {
                tenantId: rule.tenantId,
                type: 'automation_triggered',
                priority: 3,
                title: `Otomatik Eylem Alındı: ${rule.name}`,
                description: `Sistem kural motoru tarafından otomatik işlendi. Aksiyon: ${rule.actionType}`,
                suggestedAction: 'Sistem tarafından uygulandı. İnceleyebilirsiniz.',
                metadata: { ruleId: rule.id, executedParam: rule.actionData },
                isCompleted: true,
            }
        });
    }
}
