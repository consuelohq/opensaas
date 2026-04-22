import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";

import * as Sentry from "@sentry/node";
import {
  CadenceOptimizerService,
  type AgeBucket,
  type CadencePolicy,
  type HazardEstimate,
} from "@consuelo/dialer";
import { DataSource } from "typeorm";

import { CallTimingStore } from "src/engine/core-modules/consuelo-api/services/call-timing-store";
import { StoppingModelStoreService } from "src/engine/core-modules/consuelo-api/services/stopping-model-store.service";

const DEFAULT_CADENCE_ECONOMICS = {
  valuePerConnection: 100,
  costPerAttempt: 0.03,
};

@Injectable()
export class CadenceStoreService {
  private readonly logger = new Logger(CadenceStoreService.name);
  private readonly cadenceOptimizerService = new CadenceOptimizerService();
  private readonly minSampleSize = 50;
  private retryReasonColumnAvailable: boolean | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly callTimingStore: CallTimingStore,
    private readonly stoppingModelStore: StoppingModelStoreService,
  ) {}

  async getCadencePolicy(params: {
    workspaceId: string;
    segmentId: string;
    cadenceReferenceAt: Date;
  }): Promise<CadencePolicy> {
    const ageBucket = this.cadenceOptimizerService.classifyAgeBucket(
      params.cadenceReferenceAt,
    );
    const segmentedId = this.getSegmentId(params.segmentId, ageBucket);

    try {
      const economics = await this.stoppingModelStore.getWorkspaceEconomics(
        params.workspaceId,
      );

      const segmentHazards = await this.callTimingStore.getHazardEstimates(
        segmentedId,
        undefined,
        params.workspaceId,
      );

      if (this.getSampleSize(segmentHazards) >= this.minSampleSize) {
        return this.cadenceOptimizerService.computeCadencePolicy({
          segmentId: segmentedId,
          ageBucket,
          hazardEstimates: segmentHazards,
          economics,
          minSampleSize: this.minSampleSize,
        });
      }

      const ageBucketHazards = await this.getAgeBucketHazardEstimates({
        workspaceId: params.workspaceId,
        ageBucket,
        segmentId: segmentedId,
      });

      if (this.getSampleSize(ageBucketHazards) >= this.minSampleSize) {
        const ageBucketPolicy =
          this.cadenceOptimizerService.computeCadencePolicy({
            segmentId: segmentedId,
            ageBucket,
            hazardEstimates: ageBucketHazards,
            economics,
            minSampleSize: this.minSampleSize,
          });

        return {
          ...ageBucketPolicy,
          source: "age_bucket_default",
        };
      }

      return this.cadenceOptimizerService.computeCadencePolicy({
        segmentId: segmentedId,
        ageBucket,
        hazardEstimates: [],
        economics,
        minSampleSize: this.minSampleSize,
      });
    } catch (err: unknown) {
      this.logger.warn(
        "[CadenceStoreService] failed to load cadence policy, using static fallback",
        {
          workspaceId: params.workspaceId,
          segmentId: params.segmentId,
          ageBucket,
        },
      );
      Sentry.captureException(err, {
        tags: {
          component: "CadenceStoreService",
          operation: "getCadencePolicy",
        },
        extra: {
          workspaceId: params.workspaceId,
          segmentId: params.segmentId,
          ageBucket,
        },
      });

      return this.cadenceOptimizerService.computeCadencePolicy({
        segmentId: segmentedId,
        ageBucket,
        hazardEstimates: [],
        economics: DEFAULT_CADENCE_ECONOMICS,
        minSampleSize: this.minSampleSize,
      });
    }
  }

  async shouldDoubleDial(params: {
    workspaceId: string;
    queueId: string;
    contactId: string;
    outcome: string;
    callDurationSeconds: number;
  }): Promise<boolean> {
    const cadenceEnabled = await this.isCadenceOptimizationEnabled(
      params.workspaceId,
    );

    if (!cadenceEnabled) {
      return false;
    }

    const queueRows: Array<{
      category: string | null;
      started_at: string | null;
      contact_created_at: string | null;
      first_attempt_at: string | null;
    }> = await this.dataSource.query(
      `SELECT
         cq.category,
         cq.started_at,
         contacts.created_at AS contact_created_at,
         first_attempts.first_attempt_at
       FROM call_queues cq
       JOIN queue_items qi ON qi.queue_id = cq.id
       LEFT JOIN contacts
         ON contacts.id::text = qi.contact_id
        AND contacts.workspace_id::text = cq.workspace_id
       LEFT JOIN LATERAL (
         SELECT MIN(attempted_at) AS first_attempt_at
         FROM (
           SELECT prior_qi.last_attempt_at AS attempted_at
           FROM queue_items prior_qi
           JOIN call_queues prior_cq ON prior_cq.id = prior_qi.queue_id
           WHERE prior_qi.contact_id = qi.contact_id
             AND prior_cq.workspace_id = cq.workspace_id
             AND prior_qi.last_attempt_at IS NOT NULL

           UNION ALL

           SELECT COALESCE(calls.start_time, calls.created_at) AS attempted_at
           FROM calls
           WHERE calls.contact_id::text = qi.contact_id
             AND calls.workspace_id::text = cq.workspace_id
             AND COALESCE(calls.start_time, calls.created_at) IS NOT NULL
         ) attempts
       ) first_attempts ON true
       WHERE cq.workspace_id = $1
         AND cq.id = $2
         AND qi.contact_id = $3
         AND qi.status = 'calling'
       ORDER BY qi.position ASC
       LIMIT 1`,
      [params.workspaceId, params.queueId, params.contactId],
    );

    const queueData = queueRows[0];

    if (!queueData) {
      return false;
    }

    const cadenceReferenceAt = this.resolveCadenceReferenceAt({
      contactCreatedAt: queueData.contact_created_at,
      firstAttemptAt: queueData.first_attempt_at,
    });

    const policy = await this.getCadencePolicy({
      workspaceId: params.workspaceId,
      segmentId: queueData.category ?? "all",
      cadenceReferenceAt,
    });

    const [minutesSinceLastAttempt, doubleDialsThisSession] = await Promise.all(
      [
        this.getMinutesSinceLastAttempt({
          workspaceId: params.workspaceId,
          queueId: params.queueId,
          contactId: params.contactId,
        }),
        this.getDoubleDialsThisSession({
          queueId: params.queueId,
          contactId: params.contactId,
          queueStartedAt: queueData.started_at,
        }),
      ],
    );

    return this.cadenceOptimizerService.shouldDoubleDial({
      outcome: params.outcome,
      callDurationSeconds: params.callDurationSeconds,
      minutesSinceLastAttempt,
      doubleDialsThisSession,
      policy,
    });
  }

  async isCadenceOptimizationEnabled(workspaceId: string): Promise<boolean> {
    const rows: Array<{ cadence_optimization: boolean | null }> =
      await this.dataSource.query(
        `SELECT COALESCE((dialer_config->>'cadenceOptimization')::boolean, false) AS cadence_optimization
         FROM core.workspace_settings
         WHERE workspace_id = $1::uuid
         LIMIT 1`,
        [workspaceId],
      );

    return rows[0]?.cadence_optimization === true;
  }

  classifyAgeBucket(contactCreatedAt: Date) {
    return this.cadenceOptimizerService.classifyAgeBucket(contactCreatedAt);
  }

  resolveCadenceReferenceAt(params: {
    contactCreatedAt?: string | Date | null;
    firstAttemptAt?: string | Date | null;
  }) {
    const contactCreatedAt = params.contactCreatedAt
      ? new Date(params.contactCreatedAt)
      : null;
    const firstAttemptAt = params.firstAttemptAt
      ? new Date(params.firstAttemptAt)
      : null;

    if (contactCreatedAt && firstAttemptAt) {
      return firstAttemptAt > contactCreatedAt
        ? firstAttemptAt
        : contactCreatedAt;
    }

    return firstAttemptAt ?? contactCreatedAt ?? new Date();
  }

  private async getAgeBucketHazardEstimates(params: {
    workspaceId: string;
    ageBucket: AgeBucket;
    segmentId: string;
  }): Promise<HazardEstimate[]> {
    const rows: Array<{
      segment_id: string;
      hour_of_day: number;
      day_of_week: number;
      attempt_number: number;
      answer_rate: string | number;
      sample_size: string | number;
    }> = await this.dataSource.query(
      `SELECT
         $2::text AS segment_id,
         hour_of_day,
         day_of_week,
         attempt_number,
         COALESCE(
           SUM(answer_rate * sample_size) / NULLIF(SUM(sample_size), 0),
           0
         ) AS answer_rate,
         SUM(sample_size) AS sample_size
       FROM core.contact_attempt_hazard_hourly_mv
       WHERE workspace_id = $1
         AND segment_id LIKE $3
       GROUP BY hour_of_day, day_of_week, attempt_number`,
      [params.workspaceId, params.segmentId, `%:${params.ageBucket}`],
    );

    return rows.map((row) => ({
      segmentId: row.segment_id,
      hourOfDay: Number(row.hour_of_day),
      dayOfWeek: Number(row.day_of_week),
      attemptNumber: Number(row.attempt_number),
      answerRate: Number(row.answer_rate),
      sampleSize: Number(row.sample_size),
    }));
  }

  private getSampleSize(hazardEstimates: HazardEstimate[]) {
    return hazardEstimates.reduce(
      (accumulator, estimate) => accumulator + estimate.sampleSize,
      0,
    );
  }

  private getSegmentId(segmentId: string, ageBucket: AgeBucket) {
    if (segmentId.endsWith(`:${ageBucket}`)) {
      return segmentId;
    }

    return `${segmentId}:${ageBucket}`;
  }

  private async getMinutesSinceLastAttempt(params: {
    workspaceId: string;
    queueId: string;
    contactId: string;
  }): Promise<number> {
    const rows: Array<{ last_attempt_at: string | null }> =
      await this.dataSource.query(
        `SELECT MAX(previous_qi.last_attempt_at) AS last_attempt_at
         FROM queue_items current_qi
         JOIN call_queues cq ON cq.id = current_qi.queue_id
         LEFT JOIN queue_items previous_qi
           ON previous_qi.contact_id = current_qi.contact_id
          AND previous_qi.id <> current_qi.id
          AND previous_qi.last_attempt_at IS NOT NULL
         WHERE cq.workspace_id = $1
           AND current_qi.queue_id = $2
           AND current_qi.contact_id = $3
           AND current_qi.status = 'calling'`,
        [params.workspaceId, params.queueId, params.contactId],
      );

    const timestamp = rows[0]?.last_attempt_at;

    if (!timestamp) {
      return Number.POSITIVE_INFINITY;
    }

    const deltaMilliseconds = Date.now() - new Date(timestamp).getTime();

    return deltaMilliseconds / (1000 * 60);
  }

  private async getDoubleDialsThisSession(params: {
    queueId: string;
    contactId: string;
    queueStartedAt: string | null;
  }): Promise<number> {
    try {
      if (!(await this.hasRetryReasonColumn())) {
        return 0;
      }

      const rows: Array<{ count: string | number }> =
        await this.dataSource.query(
          `SELECT COUNT(*) AS count
         FROM queue_items
         WHERE queue_id = $1
           AND contact_id = $2
           AND retry_reason IN ('double_dial', 'double_dial_attempted')
           AND last_attempt_at >= COALESCE($3::timestamptz, to_timestamp(0))`,
          [params.queueId, params.contactId, params.queueStartedAt],
        );

      return Number(rows[0]?.count ?? 0);
    } catch (err: unknown) {
      this.logger.warn(
        "[CadenceStoreService] double-dial session check failed",
        {
          queueId: params.queueId,
          contactId: params.contactId,
        },
      );
      Sentry.captureException(err, {
        tags: {
          component: "CadenceStoreService",
          operation: "getDoubleDialsThisSession",
        },
        extra: {
          queueId: params.queueId,
          contactId: params.contactId,
        },
      });

      return 0;
    }
  }

  private async hasRetryReasonColumn() {
    if (this.retryReasonColumnAvailable !== null) {
      return this.retryReasonColumnAvailable;
    }

    const rows: Array<{ column_name: string }> = await this.dataSource.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'queue_items'
         AND column_name = 'retry_reason'`,
    );

    this.retryReasonColumnAvailable = rows.length === 1;

    return this.retryReasonColumnAvailable;
  }
}
