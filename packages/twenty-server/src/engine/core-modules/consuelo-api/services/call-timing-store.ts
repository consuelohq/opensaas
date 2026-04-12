import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import type { HazardEstimate, TimingModelStore } from '@consuelo/dialer';
import { DataSource } from 'typeorm';

@Injectable()
export class CallTimingStore implements TimingModelStore {
  private readonly logger = new Logger(CallTimingStore.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getHazardEstimates(
    segmentId: string,
    attemptNumber?: number,
    workspaceId?: string,
  ): Promise<HazardEstimate[]> {
    try {
      const rows = await this.dataSource.query(
        `SELECT segment_id, hour_of_day, day_of_week, attempt_number, answer_rate, sample_size
         FROM core.contact_attempt_hazard_hourly_mv
         WHERE segment_id = $1
           AND ($2::int IS NULL OR attempt_number = $2)
           AND ($3::text IS NULL OR workspace_id = $3)
         ORDER BY answer_rate DESC, sample_size DESC`,
        [segmentId, attemptNumber ?? null, workspaceId ?? null],
      );

      return rows.map((row: Record<string, unknown>) => ({
        segmentId: String(row.segment_id),
        hourOfDay: Number(row.hour_of_day),
        dayOfWeek: Number(row.day_of_week),
        attemptNumber: Number(row.attempt_number),
        answerRate: Number(row.answer_rate),
        sampleSize: Number(row.sample_size),
      }));
    } catch (err: unknown) {
      this.logger.error('failed to load hazard estimates', {
        segmentId,
        attemptNumber,
        error: err instanceof Error ? err.message : 'unknown',
      });

      return [];
    }
  }

  async getOptimalRetryTime(
    segmentId: string,
    attemptNumber: number,
    workspaceId?: string,
  ): Promise<{ hour: number; dayOfWeek: number } | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT hour_of_day, day_of_week
         FROM core.contact_attempt_hazard_hourly_mv
         WHERE segment_id = $1
           AND attempt_number = $2
           AND ($3::text IS NULL OR workspace_id = $3)
         ORDER BY answer_rate DESC, sample_size DESC
         LIMIT 1`,
        [segmentId, attemptNumber, workspaceId ?? null],
      );

      const bestRow = rows[0];

      if (!bestRow) {
        return null;
      }

      return {
        hour: Number(bestRow.hour_of_day),
        dayOfWeek: Number(bestRow.day_of_week),
      };
    } catch (err: unknown) {
      this.logger.error('failed to get optimal retry time', {
        segmentId,
        attemptNumber,
        error: err instanceof Error ? err.message : 'unknown',
      });

      return null;
    }
  }
}
