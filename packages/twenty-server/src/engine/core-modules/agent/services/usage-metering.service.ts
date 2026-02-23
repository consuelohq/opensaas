import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

// redis key prefix for all usage counters
const USAGE_KEY_PREFIX = 'agent:usage';

// 30-day period in milliseconds for counter TTL
const PERIOD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type UsageMeter =
  | 'agent.llm.tokens'
  | 'agent.sandbox.executions'
  | 'agent.conversations';

type UsageSummary = {
  meters: Record<UsageMeter, number>;
  periodStart: string;
  periodEnd: string;
};

type UsageBreakdownEntry = {
  meter: UsageMeter;
  total: number;
};

type UsageBreakdown = {
  entries: UsageBreakdownEntry[];
  periodStart: string;
  periodEnd: string;
};

const ALL_METERS: UsageMeter[] = [
  'agent.llm.tokens',
  'agent.sandbox.executions',
  'agent.conversations',
];

@Injectable()
export class UsageMeteringService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  private buildKey(
    meter: UsageMeter,
    userId: string,
    workspaceId: string,
  ): string {
    const period = this.getCurrentPeriod();

    return `${USAGE_KEY_PREFIX}:${workspaceId}:${userId}:${period}:${meter}`;
  }

  // monthly billing period based on UTC date
  private getCurrentPeriod(): string {
    const now = new Date();

    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private getPeriodBounds(): { start: string; end: string } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  async recordUsage(
    meter: UsageMeter,
    amount: number,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const key = this.buildKey(meter, userId, workspaceId);

    try {
      const current = await this.cacheStorage.get<number>(key);
      const updated = (current ?? 0) + amount;

      await this.cacheStorage.set(key, updated, PERIOD_TTL_MS);
    } catch (err: unknown) {
      // non-critical — usage tracking should not break the caller
      const message = err instanceof Error ? err.message : 'unknown error';

      throw new Error(`Failed to record usage for ${meter}: ${message}`);
    }
  }

  async getUsageSummary(
    userId: string,
    workspaceId: string,
  ): Promise<UsageSummary> {
    const bounds = this.getPeriodBounds();

    try {
      const results = await Promise.all(
        ALL_METERS.map(async (meter) => {
          const key = this.buildKey(meter, userId, workspaceId);
          const value = await this.cacheStorage.get<number>(key);

          return [meter, value ?? 0] as const;
        }),
      );

      const meters = Object.fromEntries(results) as Record<UsageMeter, number>;

      return {
        meters,
        periodStart: bounds.start,
        periodEnd: bounds.end,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      throw new Error(`Failed to get usage summary: ${message}`);
    }
  }

  async getUsageBreakdown(
    userId: string,
    workspaceId: string,
  ): Promise<UsageBreakdown> {
    const bounds = this.getPeriodBounds();

    try {
      const entries = await Promise.all(
        ALL_METERS.map(async (meter) => {
          const key = this.buildKey(meter, userId, workspaceId);
          const value = await this.cacheStorage.get<number>(key);

          return { meter, total: value ?? 0 };
        }),
      );

      return {
        entries,
        periodStart: bounds.start,
        periodEnd: bounds.end,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      throw new Error(`Failed to get usage breakdown: ${message}`);
    }
  }
}
