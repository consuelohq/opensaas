import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import type { HazardEstimate, TimingModelStore } from '@consuelo/dialer';
import { DataSource } from 'typeorm';

@Injectable()
export class CallTimingStore implements TimingModelStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getHazardEstimates(
    segmentId: string,
    attemptNumber?: number,
  ): Promise<HazardEstimate[]> {
    const rows = await this.dataSource.query(
      `SELECT segment_id, hour_of_day, day_of_week, attempt_number, answer_rate, sample_size
       FROM core.contact_attempt_hazard_hourly_mv
       WHERE segment_id = $1
         AND ($2::int IS NULL OR attempt_number = $2)
       ORDER BY answer_rate DESC, sample_size DESC`,
      [segmentId, attemptNumber ?? null],
    );

    return rows.map((row: Record<string, unknown>) => ({
      segmentId: String(row.segment_id),
      hourOfDay: Number(row.hour_of_day),
      dayOfWeek: Number(row.day_of_week),
      attemptNumber: Number(row.attempt_number),
      answerRate: Number(row.answer_rate),
      sampleSize: Number(row.sample_size),
    }));
  }

  async getOptimalRetryTime(
    segmentId: string,
    attemptNumber: number,
  ): Promise<{ hour: number; dayOfWeek: number } | null> {
    const rows = await this.dataSource.query(
      `SELECT hour_of_day, day_of_week
       FROM core.contact_attempt_hazard_hourly_mv
       WHERE segment_id = $1
         AND attempt_number = $2
       ORDER BY answer_rate DESC, sample_size DESC
       LIMIT 1`,
      [segmentId, attemptNumber],
    );

    const bestRow = rows[0];

    if (!bestRow) {
      return null;
    }

    return {
      hour: Number(bestRow.hour_of_day),
      dayOfWeek: Number(bestRow.day_of_week),
    };
  }
}
