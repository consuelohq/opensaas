import { Injectable, Logger } from '@nestjs/common';

import { MoreThan } from 'typeorm';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';

type DealInput = {
  id: string;
  name: string;
  stage: string;
  value: number;
  closeDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  daysInCurrentStage: number;
  daysSinceLastInteraction: number;
  hasChampion: boolean;
  hasFriendlyContact: boolean;
  hasCompetitor: boolean;
  hasActiveCompetitor: boolean;
};

type StageAverage = {
  stage: string;
  averageDays: number;
  probability: number;
};

type DealChange = {
  dealId: string;
  dealName: string;
  changeType:
    | 'stage_change'
    | 'amount_change'
    | 'close_date_change'
    | 'new_deal';
  detail: string;
  changedAt: Date;
};

type PipelineContextResult = {
  health: {
    score: number;
    label: 'healthy' | 'warning' | 'critical';
    totalDeals: number;
    forecastedRevenue: number;
    insights: string[];
  };
  topRisks: Array<{
    dealId: string;
    dealName: string;
    stage: string;
    riskScore: number;
    factors: Array<{
      id: string;
      label: string;
      score: number;
      weight: number;
    }>;
    value: number;
  }>;
  recentChanges: DealChange[];
};

const CACHE_TTL_MS = 15 * 60 * 1000;

// default stage probabilities when no historical data exists
const DEFAULT_STAGE_PROBABILITIES: Record<string, number> = {
  QUALIFICATION: 0.1,
  MEETING: 0.2,
  PROPOSAL: 0.4,
  NEGOTIATION: 0.6,
  CLOSED_WON: 1.0,
  CLOSED_LOST: 0,
};

const daysBetween = (a: Date, b: Date): number =>
  Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));

@Injectable()
export class PipelineIntelligenceService {
  private readonly logger = new Logger(PipelineIntelligenceService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  async getPipelineContext(
    userId: string,
    workspaceId: string,
  ): Promise<PipelineContextResult | null> {
    try {
      const cacheKey = `pipeline:context:${userId}:${workspaceId}`;
      const cached =
        await this.cacheStorage.get<PipelineContextResult>(cacheKey);

      if (cached) return cached;

      const deals = await this.getOpenDeals(workspaceId);

      if (deals.length === 0) return null;

      const stageAverages = this.getStageAverages(deals);
      const recentChanges = await this.getRecentChanges(workspaceId);

      // use the pure functions from the agent package
      const { buildPipelineContext } = await import('@consuelo/agent');

      const result = buildPipelineContext(
        deals,
        stageAverages,
        recentChanges,
      ) as PipelineContextResult;

      await this.cacheStorage.set(cacheKey, result, CACHE_TTL_MS);

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(
        `pipeline context failed for user ${userId}: ${message}`,
      );

      return null;
    }
  }

  private async getOpenDeals(workspaceId: string): Promise<DealInput[]> {
    const opportunityRepository =
      await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
        workspaceId,
        'opportunity',
        { shouldBypassPermissionChecks: true },
      );

    const opportunities = await opportunityRepository.find({});

    const now = new Date();

    return opportunities
      .filter(
        (opp) => opp.stage !== 'CLOSED_WON' && opp.stage !== 'CLOSED_LOST',
      )
      .map((opp) => ({
        id: opp.id,
        name: opp.name || 'Unnamed deal',
        stage: opp.stage || 'QUALIFICATION',
        value: opp.amount?.amountMicros
          ? Number(opp.amount.amountMicros) / 1_000_000
          : 0,
        closeDate: opp.closeDate ? new Date(opp.closeDate) : null,
        createdAt: new Date(opp.createdAt),
        updatedAt: new Date(opp.updatedAt),
        daysInCurrentStage: daysBetween(new Date(opp.updatedAt), now),
        daysSinceLastInteraction: daysBetween(new Date(opp.updatedAt), now),
        hasChampion: false,
        hasFriendlyContact: !!opp.pointOfContactId,
        hasCompetitor: false,
        hasActiveCompetitor: false,
      }));
  }

  private getStageAverages(deals: DealInput[]): StageAverage[] {
    const stageMap = new Map<string, number[]>();

    for (const deal of deals) {
      const existing = stageMap.get(deal.stage) ?? [];

      existing.push(deal.daysInCurrentStage);
      stageMap.set(deal.stage, existing);
    }

    const averages: StageAverage[] = [];

    for (const [stage, days] of stageMap) {
      const avg = days.reduce((sum, d) => sum + d, 0) / days.length;

      averages.push({
        stage,
        averageDays: Math.round(avg),
        probability: DEFAULT_STAGE_PROBABILITIES[stage] ?? 0.5,
      });
    }

    return averages;
  }

  private async getRecentChanges(workspaceId: string): Promise<DealChange[]> {
    try {
      const sevenDaysAgo = new Date();

      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const opportunityRepository =
        await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
          workspaceId,
          'opportunity',
          { shouldBypassPermissionChecks: true },
        );

      const recentOpps = await opportunityRepository.find({
        where: {
          updatedAt: MoreThan(sevenDaysAgo.toISOString()),
        },
        order: { updatedAt: 'DESC' },
        take: 10,
      });

      return recentOpps.map((opp) => {
        const sevenDaysAgoTime = new Date();

        sevenDaysAgoTime.setDate(sevenDaysAgoTime.getDate() - 7);

        const isNew = new Date(opp.createdAt) > sevenDaysAgoTime;

        return {
          dealId: opp.id,
          dealName: opp.name || 'Unnamed deal',
          changeType: isNew
            ? ('stage_change' as const)
            : ('stage_change' as const),
          detail: isNew
            ? `New deal created in ${opp.stage || 'QUALIFICATION'}`
            : `Updated in ${opp.stage || 'QUALIFICATION'}`,
          changedAt: new Date(opp.updatedAt),
        };
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`recent changes query failed: ${message}`);

      return [];
    }
  }
}
