import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import type { StoppingModelStore } from '@consuelo/dialer';
import { DataSource } from 'typeorm';

const DEFAULT_AVERAGE_DEAL_VALUE = 1000;
const DEFAULT_AVERAGE_CLOSE_RATE = 0.1;
const DEFAULT_COST_PER_ATTEMPT = 0.03;
const MIN_SAMPLE_SIZE_PER_ATTEMPT = 5;

@Injectable()
export class StoppingModelStoreService implements StoppingModelStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getAnswerProbabilities(
    segmentId: string,
  ): Promise<{ attemptNumber: number; probability: number }[]> {
    const rows: Array<{
      attempt_number: number;
      probability: string | number;
      sample_size: string | number;
    }> = await this.dataSource.query(
      `WITH base AS (
         SELECT attempts, call_outcome
         FROM queue_items
         WHERE queue_id = $1
           AND attempts > 0
       ),
       attempt_numbers AS (
         SELECT generate_series(1, COALESCE((SELECT MAX(attempts) FROM base), 0)) AS attempt_number
       )
       SELECT
         attempt_numbers.attempt_number,
         SUM(
           CASE
             WHEN base.call_outcome = 'connected'
               AND base.attempts = attempt_numbers.attempt_number THEN 1
             ELSE 0
           END
         )::float / NULLIF(
           SUM(CASE WHEN base.attempts >= attempt_numbers.attempt_number THEN 1 ELSE 0 END),
           0
         ) AS probability,
         SUM(CASE WHEN base.attempts >= attempt_numbers.attempt_number THEN 1 ELSE 0 END) AS sample_size
       FROM attempt_numbers
       CROSS JOIN base
       GROUP BY attempt_numbers.attempt_number
       HAVING SUM(CASE WHEN base.attempts >= attempt_numbers.attempt_number THEN 1 ELSE 0 END) >= $2
       ORDER BY attempt_numbers.attempt_number ASC`,
      [segmentId, MIN_SAMPLE_SIZE_PER_ATTEMPT],
    );

    return rows.map((row) => ({
      attemptNumber: Number(row.attempt_number),
      probability: Number(row.probability ?? 0),
    }));
  }

  async getWorkspaceEconomics(workspaceId: string): Promise<{
    valuePerConnection: number;
    costPerAttempt: number;
  }> {
    const rows: Array<{
      avgDealValue: string | number | null;
      avgCloseRate: string | number | null;
    }> = await this.dataSource.query(
      `SELECT
         COALESCE((dialer_config->>'avgDealValue')::numeric, $2::numeric) AS "avgDealValue",
         COALESCE((dialer_config->>'avgCloseRate')::numeric, $3::numeric) AS "avgCloseRate"
       FROM core.workspace_settings
       WHERE workspace_id = $1::uuid
       LIMIT 1`,
      [workspaceId, DEFAULT_AVERAGE_DEAL_VALUE, DEFAULT_AVERAGE_CLOSE_RATE],
    );

    const economics = rows[0];
    const avgDealValue = Number(economics?.avgDealValue ?? DEFAULT_AVERAGE_DEAL_VALUE);
    const avgCloseRate = Number(economics?.avgCloseRate ?? DEFAULT_AVERAGE_CLOSE_RATE);

    return {
      valuePerConnection: avgDealValue * avgCloseRate,
      costPerAttempt: DEFAULT_COST_PER_ATTEMPT,
    };
  }
}
