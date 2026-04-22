import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { StoppingModelStore } from '@consuelo/dialer';
import { DataSource } from 'typeorm';

export const DEFAULT_AVERAGE_DEAL_VALUE = 1000;
export const DEFAULT_AVERAGE_CLOSE_RATE = 0.1;
export const DEFAULT_COST_PER_ATTEMPT = 0.03;

export const DEFAULT_WORKSPACE_ECONOMICS = {
  valuePerConnection: DEFAULT_AVERAGE_DEAL_VALUE * DEFAULT_AVERAGE_CLOSE_RATE,
  costPerAttempt: DEFAULT_COST_PER_ATTEMPT,
};

export function resolveWorkspaceEconomics(params: {
  avgDealValue: number | string | null | undefined;
  avgCloseRate: number | string | null | undefined;
  costPerAttempt: number | string | null | undefined;
}) {
  const avgDealValue = Number(
    params.avgDealValue ?? DEFAULT_AVERAGE_DEAL_VALUE,
  );
  const avgCloseRate = Number(
    params.avgCloseRate ?? DEFAULT_AVERAGE_CLOSE_RATE,
  );
  const costPerAttempt = Number(
    params.costPerAttempt ?? DEFAULT_COST_PER_ATTEMPT,
  );

  return {
    valuePerConnection: avgDealValue * avgCloseRate,
    costPerAttempt: Math.max(
      0,
      Number.isFinite(costPerAttempt)
        ? costPerAttempt
        : DEFAULT_COST_PER_ATTEMPT,
    ),
  };
}

const MIN_SAMPLE_SIZE_PER_ATTEMPT = 5;

@Injectable()
export class StoppingModelStoreService implements StoppingModelStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getAnswerProbabilities(
    segmentId: string,
  ): Promise<{ attemptNumber: number; probability: number }[]> {
    const rows: Array<{ attemptNumber: string | number; probability: string }> =
      await this.dataSource.query(
        `WITH base AS (
          SELECT attempts, call_outcome
          FROM queue_items
          WHERE queue_id = $1
          AND attempts > 0
          AND status <> 'calling'
          AND call_outcome IS NOT NULL
          ),
        by_attempt AS (
          SELECT
            attempts AS "attemptNumber",
            COUNT(*) AS total,
            SUM(CASE WHEN call_outcome = 'answered' THEN 1 ELSE 0 END) AS answered
          FROM base
          GROUP BY attempts
        )
        SELECT
          "attemptNumber",
          CASE WHEN total >= $2 THEN answered::numeric / total::numeric ELSE NULL END AS probability
        FROM by_attempt
        WHERE total >= $2
        ORDER BY "attemptNumber" ASC`,
        [segmentId, MIN_SAMPLE_SIZE_PER_ATTEMPT],
      );

    return rows
      .filter((row) => row.probability !== null)
      .map((row) => ({
        attemptNumber: Number(row.attemptNumber),
        probability: Number(row.probability),
      }));
  }

  async getWorkspaceEconomics(workspaceId: string): Promise<{
    valuePerConnection: number;
    costPerAttempt: number;
  }> {
    const rows: Array<{
      avgDealValue: string | number | null;
      avgCloseRate: string | number | null;
      costPerAttempt: string | number | null;
    }> = await this.dataSource.query(
      `SELECT
        CASE
          WHEN (dialer_config->>'avgDealValue') ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN (dialer_config->>'avgDealValue')::numeric
          ELSE NULL
        END AS "avgDealValue",
        CASE
          WHEN (dialer_config->>'avgCloseRate') ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN (dialer_config->>'avgCloseRate')::numeric
          ELSE NULL
        END AS "avgCloseRate",
        CASE
          WHEN (dialer_config->>'costPerAttempt') ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN (dialer_config->>'costPerAttempt')::numeric
          ELSE NULL
        END AS "costPerAttempt"
      FROM core.workspace_settings
      WHERE workspace_id = $1::uuid
      LIMIT 1`,
      [workspaceId],
    );

    const economics = rows[0];

    return resolveWorkspaceEconomics({
      avgDealValue: economics?.avgDealValue,
      avgCloseRate: economics?.avgCloseRate,
      costPerAttempt: economics?.costPerAttempt,
    });
  }
}
