import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";

import * as Sentry from "@sentry/node";
import { StoppingModelService, type CadencePolicy } from "@consuelo/dialer";
import { DataSource } from "typeorm";

import { CallTimingModelService } from "src/engine/core-modules/consuelo-api/services/call-timing-model.service";
import { CadenceStoreService } from "src/engine/core-modules/consuelo-api/services/cadence-store.service";
import { evaluateRetryPolicy } from "src/engine/core-modules/consuelo-api/services/retry-policy";
import { StoppingModelStoreService } from "src/engine/core-modules/consuelo-api/services/stopping-model-store.service";
import { WhittleIndexStoreService } from "src/engine/core-modules/consuelo-api/services/whittle-index-store.service";

type QueueSettings = {
  minRetrySpacingMinutes?: number;
  maxAttemptsPerDay?: number;
  maxAttemptsPerWeek?: number;
  maxAttempts?: number;
  retryAttemptCap?: number;
};

type QueueListFilters = {
  sourceType?: string;
  sourceId?: string;
};

type QueueSelectionResult = {
  nextItem: Record<string, unknown> | null;
  suppression: { contactId: string; reason: string } | null;
  ranking?: {
    index: number;
    components?: {
      expectedReward: number;
      cost: number;
      urgencyBonus: number;
      explorationBonus: number;
    };
    candidatesEvaluated: number;
    selectionMethod: "whittle_index" | "fifo_fallback";
  };
};

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);
  private queueRetryColumnsAvailable: boolean | null = null;
  private readonly stoppingModelService: StoppingModelService;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stoppingModelStore: StoppingModelStoreService,
    private readonly callTimingModelService: CallTimingModelService,
    private readonly whittleIndexStore: WhittleIndexStoreService,
    private readonly cadenceStore: CadenceStoreService,
  ) {
    this.stoppingModelService = new StoppingModelService(
      this.stoppingModelStore,
    );
  }

  async createQueue(params: {
    workspaceId: string;
    userId: string;
    name: string;
    sourceType?: string;
    sourceId?: string;
    category?: string;
    contactIds: string[];
    settings?: Record<string, unknown>;
  }) {
    try {
      const queueRows = await this.dataSource.query(
        "INSERT INTO call_queues (workspace_id, user_id, name, source_type, source_id, category, settings, total_contacts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [
          params.workspaceId,
          params.userId,
          params.name,
          params.sourceType ?? "manual",
          params.sourceId ?? null,
          params.category ?? "all",
          JSON.stringify(params.settings ?? {}),
          params.contactIds.length,
        ],
      );

      const queue = queueRows[0];

      if (params.contactIds.length > 0) {
        const valuesClause = params.contactIds
          .map((_, index) => `($1, $${index + 2}, ${index + 1})`)
          .join(",");

        await this.dataSource.query(
          `INSERT INTO queue_items (queue_id, contact_id, position) VALUES ${valuesClause}`,
          [queue.id, ...params.contactIds],
        );
      }

      return queue;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`createQueue failed: ${message}`, {
        workspaceId: params.workspaceId,
      });
      throw err;
    }
  }

  async listQueues(workspaceId: string, filters: QueueListFilters = {}) {
    try {
      const whereClauses = ["workspace_id = $1"];
      const params: Array<string> = [workspaceId];

      if (filters.sourceType) {
        whereClauses.push(`source_type = $${params.length + 1}`);
        params.push(filters.sourceType);
      }

      if (filters.sourceId) {
        whereClauses.push(`source_id = $${params.length + 1}`);
        params.push(filters.sourceId);
      }

      return this.dataSource.query(
        `SELECT * FROM call_queues WHERE ${whereClauses.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`listQueues failed: ${message}`, { workspaceId });
      throw err;
    }
  }

  async getQueue(workspaceId: string, id: string) {
    try {
      const queueRows = await this.dataSource.query(
        "SELECT * FROM call_queues WHERE id = $1 AND workspace_id = $2",
        [id, workspaceId],
      );
      const queue = queueRows[0];

      if (!queue) {
        return null;
      }

      const items = await this.dataSource.query(
        "SELECT * FROM queue_items WHERE queue_id = $1 ORDER BY position ASC",
        [id],
      );

      return { ...queue, items };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`getQueue failed: ${message}`, { workspaceId, id });
      throw err;
    }
  }

  async updateQueueStatus(workspaceId: string, id: string, status: string) {
    try {
      const rows = await this.dataSource.query(
        "UPDATE call_queues SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *",
        [status, id, workspaceId],
      );

      return rows[0] ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`updateQueueStatus failed: ${message}`, {
        workspaceId,
        id,
      });
      throw err;
    }
  }

  async startQueue(workspaceId: string, id: string) {
    try {
      const queueRows = await this.dataSource.query(
        "UPDATE call_queues SET status = $1, started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *",
        ["active", id, workspaceId],
      );

      const queue = queueRows[0];

      if (!queue) {
        return null;
      }

      const existingRows = await this.dataSource.query(
        "SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 LIMIT 1",
        [id, "calling"],
      );

      if (existingRows[0]) {
        return {
          queue,
          currentItem: this.unwrapRow(existingRows[0]),
          nextItem: this.unwrapRow(existingRows[0]),
          suppression: null,
          ranking: undefined,
        };
      }

      const selection = await this.selectNextCallableItem(id, workspaceId);

      return {
        queue,
        currentItem: this.unwrapRow(selection.nextItem),
        nextItem: this.unwrapRow(selection.nextItem),
        suppression: selection.suppression,
        ranking: selection.ranking,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`startQueue failed: ${message}`, { workspaceId, id });
      throw err;
    }
  }

  async skipCurrentItem(params: { queueId: string; workspaceId: string }) {
    try {
      const queueCheck = await this.dataSource.query(
        "SELECT id FROM call_queues WHERE id = $1 AND workspace_id = $2",
        [params.queueId, params.workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      const currentRows = await this.dataSource.query(
        "SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 ORDER BY position ASC LIMIT 1 FOR UPDATE SKIP LOCKED",
        [params.queueId, "calling"],
      );
      const current = currentRows[0];

      if (!current) {
        const selection = await this.selectNextCallableItem(
          params.queueId,
          params.workspaceId,
        );

        return {
          skipped: false,
          current: null,
          nextItem: this.unwrapRow(selection.nextItem),
          suppression: selection.suppression,
          ranking: selection.ranking,
        };
      }

      const updatedRows = await this.dataSource.query(
        "UPDATE queue_items SET status = $1, skip_reason = $2 WHERE id = $3 RETURNING *",
        ["skipped", "user_skip", current.id],
      );

      await this.dataSource.query(
        "UPDATE call_queues SET skipped_contacts = skipped_contacts + 1, updated_at = NOW() WHERE id = $1",
        [params.queueId],
      );

      const selection = await this.selectNextCallableItem(
        params.queueId,
        params.workspaceId,
      );

      return {
        skipped: true,
        current: this.unwrapRow(updatedRows[0]),
        nextItem: this.unwrapRow(selection.nextItem),
        suppression: selection.suppression,
        ranking: selection.ranking,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`skipCurrentItem failed: ${message}`, {
        queueId: params.queueId,
        workspaceId: params.workspaceId,
      });
      throw err;
    }
  }

  async completeCurrentAndAdvance(params: {
    queueId: string;
    workspaceId: string;
    outcome?: string;
    isHighPriority?: boolean;
    localTimezone?: string;
  }) {
    try {
      const queueCheck = await this.dataSource.query(
        "SELECT id, settings, category FROM call_queues WHERE id = $1 AND workspace_id = $2",
        [params.queueId, params.workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      const currentRows = await this.dataSource.query(
        "SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 ORDER BY position ASC LIMIT 1 FOR UPDATE SKIP LOCKED",
        [params.queueId, "calling"],
      );
      const current = currentRows[0];

      if (!current) {
        const selection = await this.selectNextCallableItem(
          params.queueId,
          params.workspaceId,
        );

        return {
          current: null,
          nextItem: this.unwrapRow(selection.nextItem),
          suppression: selection.suppression,
          ranking: selection.ranking,
        };
      }

      const queueSettings = (queueCheck[0]?.settings ?? {}) as QueueSettings;
      const callDurationSeconds = Number(current.call_duration_seconds ?? 0);
      const shouldDoubleDial = await this.cadenceStore.shouldDoubleDial({
        workspaceId: params.workspaceId,
        queueId: params.queueId,
        contactId: String(current.contact_id),
        outcome: params.outcome ?? "",
        callDurationSeconds,
      });

      if (shouldDoubleDial && (await this.hasQueueRetryColumns())) {
        const updatedRows = await this.dataSource.query(
          `UPDATE queue_items
           SET status = $1,
               call_outcome = $2,
               retry_strategy = $3,
               retry_scheduled_at = NOW() + ($4::text || ' seconds')::interval,
               retry_reason = $5
           WHERE id = $6
           RETURNING *`,
          [
            "pending",
            params.outcome ?? null,
            "double-dial-no-answer",
            "10",
            "double_dial",
            current.id,
          ],
        );

        return {
          retryScheduled: true,
          retryStrategy: "double-dial-no-answer",
          retryScheduledAt: new Date(Date.now() + 10_000).toISOString(),
          retryReason: "double_dial",
          currentItem: this.unwrapRow(updatedRows[0]),
        };
      }

      const retryDecision = await evaluateRetryPolicy(
        {
          workspaceId: params.workspaceId,
          segmentId: params.queueId,
          outcome: params.outcome ?? null,
          isHighPriority: params.isHighPriority === true,
          attemptsUsed: Number(current.attempts ?? 0),
          maxAttempts:
            typeof queueSettings.maxAttempts === "number" &&
            queueSettings.maxAttempts > 0
              ? queueSettings.maxAttempts
              : typeof queueSettings.retryAttemptCap === "number" &&
                  queueSettings.retryAttemptCap > 0
                ? queueSettings.retryAttemptCap
                : 3,
          localTimezone: params.localTimezone ?? "America/New_York",
        },
        this.stoppingModelStore,
      );

      if (retryDecision.shouldRetry) {
        const updatedRows = await this.updateQueueItemWithRetryFallback(
          current.id,
          "pending",
          params.outcome ?? null,
          retryDecision,
        );

        return {
          retryScheduled: true,
          retryStrategy: retryDecision.retryStrategy,
          retryScheduledAt: retryDecision.retryScheduledAt,
          retryReason: retryDecision.retryReason,
          currentItem: this.unwrapRow(updatedRows[0]),
        };
      }

      const updatedRows = await this.updateQueueItemWithRetryFallback(
        current.id,
        "completed",
        params.outcome ?? null,
        retryDecision,
      );

      await this.dataSource.query(
        "UPDATE call_queues SET completed_contacts = completed_contacts + 1, updated_at = NOW() WHERE id = $1",
        [params.queueId],
      );

      const selection = await this.selectNextCallableItem(
        params.queueId,
        params.workspaceId,
      );

      if (selection.nextItem) {
        return {
          current: this.unwrapRow(updatedRows[0]),
          nextItem: this.unwrapRow(selection.nextItem),
          ranking: selection.ranking,
        };
      }

      if (selection.suppression) {
        return {
          current: this.unwrapRow(updatedRows[0]),
          nextItem: null,
          suppression: selection.suppression,
          ranking: selection.ranking,
        };
      }

      await this.dataSource.query(
        "UPDATE call_queues SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *",
        ["completed", params.queueId, params.workspaceId],
      );

      return {
        current: this.unwrapRow(updatedRows[0]),
        nextItem: null,
        queueCompleted: true,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`completeCurrentAndAdvance failed: ${message}`, {
        queueId: params.queueId,
        workspaceId: params.workspaceId,
      });
      throw err;
    }
  }

  async restartQueue(workspaceId: string, id: string) {
    try {
      const queueCheck = await this.dataSource.query(
        "SELECT id FROM call_queues WHERE id = $1 AND workspace_id = $2",
        [id, workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      await this.dataSource.query(
        "UPDATE queue_items SET status = $1, attempts = 0, call_outcome = NULL, skip_reason = NULL WHERE queue_id = $2",
        ["pending", id],
      );

      await this.dataSource.query(
        "UPDATE call_queues SET status = $1, completed_contacts = 0, skipped_contacts = 0, started_at = NULL, completed_at = NULL, updated_at = NOW() WHERE id = $2",
        ["idle", id],
      );

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`restartQueue failed: ${message}`, { workspaceId, id });
      throw err;
    }
  }

  async assignQueue(workspaceId: string, id: string, userId: string) {
    try {
      const rows = await this.dataSource.query(
        "UPDATE call_queues SET user_id = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *",
        [userId, id, workspaceId],
      );

      return rows[0] ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`assignQueue failed: ${message}`, { workspaceId, id });
      throw err;
    }
  }

  async queueAnalytics(workspaceId: string, queueId: string) {
    try {
      const queueCheck = await this.dataSource.query(
        "SELECT id FROM call_queues WHERE id::text = $1 AND workspace_id::text = $2",
        [queueId, workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      const rows: Array<{
        status: string;
        call_outcome: string | null;
        call_duration_seconds: number | null;
      }> = await this.dataSource.query(
        "SELECT status, call_outcome, call_duration_seconds FROM queue_items WHERE queue_id = $1",
        [queueId],
      );

      const total = rows.length;
      const completed = rows.filter((row) => row.status === "completed").length;
      const skipped = rows.filter((row) => row.status === "skipped").length;
      const rowsWithDuration = rows.filter(
        (row) => typeof row.call_duration_seconds === "number",
      );
      const totalDurationSeconds = rowsWithDuration.reduce(
        (acc, row) => acc + (row.call_duration_seconds ?? 0),
        0,
      );

      return {
        total,
        completed,
        skipped,
        completionRate: total === 0 ? 0 : completed / total,
        avgDurationSeconds:
          rowsWithDuration.length === 0
            ? 0
            : Math.round(totalDurationSeconds / rowsWithDuration.length),
        outcomes: rows.reduce<Record<string, number>>((acc, row) => {
          const key = row.call_outcome ?? "unknown";

          acc[key] = (acc[key] ?? 0) + 1;

          return acc;
        }, {}),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`queueAnalytics failed: ${message}`, {
        workspaceId,
        queueId,
      });
      throw err;
    }
  }

  private sanitizeCsvValue(value: string): string {
    const formulaChars = ["=", "+", "-", "@", "\t", "\r"];
    let sanitized = value;

    if (formulaChars.some((char) => sanitized.startsWith(char))) {
      sanitized = `'${sanitized}`;
    }

    return sanitized.split('"').join('""');
  }

  async exportQueueCsv(workspaceId: string, queueId: string) {
    try {
      const queueCheck = await this.dataSource.query(
        "SELECT id FROM call_queues WHERE id = $1 AND workspace_id = $2",
        [queueId, workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      const rows = await this.dataSource.query(
        `SELECT qi.id, qi.position, qi.contact_id, qi.status, qi.call_outcome, qi.call_duration_seconds,
                qi.skip_reason, qi.last_attempt_at
         FROM queue_items qi
         WHERE qi.queue_id = $1
         ORDER BY qi.position ASC`,
        [queueId],
      );

      const header =
        "id,position,contact_id,status,outcome,duration_seconds,skip_reason,attempted_at";
      const lines = rows.map((row: Record<string, unknown>) => {
        const values = [
          row.id,
          row.position,
          row.contact_id,
          row.status,
          row.call_outcome ?? "",
          row.call_duration_seconds ?? "",
          this.sanitizeCsvValue(String(row.skip_reason ?? "")),
          row.last_attempt_at ?? "",
        ];

        return values.map((value) => `"${value}"`).join(",");
      });

      return [header, ...lines].join("\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`exportQueueCsv failed: ${message}`, {
        workspaceId,
        queueId,
      });
      throw err;
    }
  }

  async getContactDialerInfo(workspaceId: string, contactId: string) {
    try {
      const contactRows = await this.dataSource.query(
        "SELECT id, name, phone FROM contacts WHERE id = $1 AND workspace_id = $2",
        [contactId, workspaceId],
      );

      const contact = contactRows[0];

      if (!contact) {
        return null;
      }

      const attempts = await this.dataSource.query(
        `SELECT qi.id, qi.call_outcome, qi.call_duration_seconds, qi.created_at 
         FROM queue_items qi
         JOIN call_queues cq ON cq.id = qi.queue_id
         WHERE qi.contact_id = $1 AND cq.workspace_id = $2 
         ORDER BY qi.created_at DESC LIMIT 20`,
        [contactId, workspaceId],
      );

      return {
        ...contact,
        attempts,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`getContactDialerInfo failed: ${message}`, {
        workspaceId,
        contactId,
      });
      throw err;
    }
  }

  private async selectNextCallableItem(
    queueId: string,
    workspaceId: string,
  ): Promise<QueueSelectionResult> {
    try {
      const queueRows = await this.dataSource.query(
        "SELECT settings, category FROM call_queues WHERE id = $1 AND workspace_id = $2",
        [queueId, workspaceId],
      );
      const settings = (queueRows[0]?.settings ?? {}) as QueueSettings;
      const category = queueRows[0]?.category ?? "all";
      const isCadenceOptimizationEnabled =
        await this.cadenceStore.isCadenceOptimizationEnabled(workspaceId);
      const cadencePolicyBySegment = new Map<string, CadencePolicy>();
      const queueRetryColumnsAvailable = await this.hasQueueRetryColumns();
      const retryReasonSelect = queueRetryColumnsAvailable
        ? "qi.retry_reason,"
        : "NULL::text AS retry_reason,";

      const rows = await this.dataSource.query(
        `SELECT
           qi.id,
           qi.contact_id,
           qi.position,
           qi.attempts,
           contacts.created_at AS contact_created_at,
           first_attempts.first_attempt_at,
           ${retryReasonSelect}
           ledger.last_attempt_at,
           ledger.attempts_today,
           ledger.attempts_this_week,
           ledger.day_window_start,
           ledger.week_window_start
         FROM queue_items qi
         JOIN call_queues cq ON cq.id = qi.queue_id
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
         LEFT JOIN contact_attempt_ledger ledger
           ON ledger.workspace_id = $2
          AND ledger.contact_id = qi.contact_id
         WHERE qi.queue_id = $1 AND qi.status = 'pending'
         ORDER BY qi.position ASC
         FOR UPDATE SKIP LOCKED`,
        [queueId, workspaceId],
      );

      const eligibleCandidates: Array<Record<string, unknown>> = [];
      let suppression: { contactId: string; reason: string } | null = null;

      // load stopping model data once (not per-candidate) to avoid N+1
      const [answerProbabilities, economics] = await Promise.all([
        this.stoppingModelStore.getAnswerProbabilities(queueId),
        this.stoppingModelStore.getWorkspaceEconomics(workspaceId),
      ]);

      const probabilityByAttempt = new Map<number, number>();

      for (const item of answerProbabilities) {
        probabilityByAttempt.set(item.attemptNumber, item.probability);
      }

      for (const row of rows as Array<Record<string, unknown>>) {
        const suppressionReason = await this.getSuppressionReason({
          settings,
          row,
          workspaceId,
          category,
          isCadenceOptimizationEnabled,
          cadencePolicyBySegment,
        });

        if (suppressionReason) {
          if (!suppression) {
            suppression = {
              contactId: String(row.contact_id ?? ""),
              reason: suppressionReason,
            };
          }

          continue;
        }

        const attemptNumber = Number(row.attempts ?? 0) + 1;
        const probability = probabilityByAttempt.get(attemptNumber);
        const shouldStop =
          probability !== undefined &&
          attemptNumber > 2 &&
          probability * economics.valuePerConnection < economics.costPerAttempt;

        if (shouldStop) {
          if (!suppression) {
            suppression = {
              contactId: String(row.contact_id ?? ""),
              reason: "STOPPING_MODEL",
            };
          }

          continue;
        }

        eligibleCandidates.push(row);

        if (eligibleCandidates.length >= 50) {
          break;
        }
      }

      if (eligibleCandidates.length === 0) {
        return { nextItem: null, suppression };
      }

      try {
        const ranked = await this.whittleIndexStore.rankCandidates({
          workspaceId,
          segmentId: category,
          localTimezone: this.getQueueLocalTimezone(settings),
          callableWindowEndHour: this.getCallableWindowEndHour(settings),
          candidates: eligibleCandidates.map((candidate) => ({
            queueItemId: String(candidate.id),
            contactId: String(candidate.contact_id),
            position: Number(candidate.position),
            attempts: Number(candidate.attempts ?? 0),
            lastAttemptAt: candidate.last_attempt_at
              ? new Date(String(candidate.last_attempt_at))
              : null,
          })),
        });

        const topRanked = ranked[0];

        if (!topRanked) {
          const fallbackItem = eligibleCandidates[0];

          return {
            nextItem: await this.claimQueueItem(workspaceId, fallbackItem),
            suppression: null,
            ranking: {
              index: 0,
              candidatesEvaluated: eligibleCandidates.length,
              selectionMethod: "fifo_fallback",
            },
          };
        }

        const selectedItem = eligibleCandidates.find(
          (candidate) => String(candidate.id) === topRanked.queueItemId,
        );

        if (!selectedItem) {
          const fallbackItem = eligibleCandidates[0];

          return {
            nextItem: await this.claimQueueItem(workspaceId, fallbackItem),
            suppression: null,
            ranking: {
              index: 0,
              candidatesEvaluated: eligibleCandidates.length,
              selectionMethod: "fifo_fallback",
            },
          };
        }

        return {
          nextItem: await this.claimQueueItem(workspaceId, selectedItem),
          suppression: null,
          ranking: {
            index: topRanked.index,
            components: topRanked.components,
            candidatesEvaluated: eligibleCandidates.length,
            selectionMethod: "whittle_index",
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";

        this.logger.warn(
          `Whittle ranking failed, using FIFO fallback: ${message}`,
          {
            queueId,
            workspaceId,
          },
        );

        Sentry.captureException(err, {
          tags: {
            component: "QueuesService",
            operation: "selectNextCallableItem",
          },
          extra: { queueId, workspaceId },
        });

        const fallbackItem = eligibleCandidates[0];

        return {
          nextItem: await this.claimQueueItem(workspaceId, fallbackItem),
          suppression: null,
          ranking: {
            index: 0,
            candidatesEvaluated: eligibleCandidates.length,
            selectionMethod: "fifo_fallback",
          },
        };
      }
    } catch (err: unknown) {
      if (this.isMissingRelationError(err, "contact_attempt_ledger")) {
        return await this.selectNextCallableItemWithoutLedger(queueId);
      }

      const message = err instanceof Error ? err.message : "Unknown error";

      this.logger.error(`selectNextCallableItem failed: ${message}`, {
        queueId,
        workspaceId,
      });
      throw err;
    }
  }

  private async getSuppressionReason(params: {
    settings: QueueSettings;
    row: Record<string, unknown>;
    workspaceId: string;
    category: string;
    isCadenceOptimizationEnabled: boolean;
    cadencePolicyBySegment: Map<string, CadencePolicy>;
  }) {
    const { settings, row } = params;
    const lastAttemptAt = row.last_attempt_at
      ? new Date(String(row.last_attempt_at))
      : null;
    const attemptsToday = Number(row.attempts_today ?? 0);
    const attemptsThisWeek = Number(row.attempts_this_week ?? 0);
    let minRetrySpacingMinutes = settings.minRetrySpacingMinutes;
    let maxAttemptsPerDay = settings.maxAttemptsPerDay;

    if (params.isCadenceOptimizationEnabled) {
      try {
        const cadenceReferenceAt = this.cadenceStore.resolveCadenceReferenceAt({
          contactCreatedAt:
            row.contact_created_at instanceof Date ||
            typeof row.contact_created_at === "string"
              ? row.contact_created_at
              : null,
          firstAttemptAt:
            row.first_attempt_at instanceof Date ||
            typeof row.first_attempt_at === "string"
              ? row.first_attempt_at
              : null,
        });
        const ageBucket =
          this.cadenceStore.classifyAgeBucket(cadenceReferenceAt);
        const cadenceSegmentId = `${params.category}:${ageBucket}`;
        let cadencePolicy = params.cadencePolicyBySegment.get(cadenceSegmentId);

        if (!cadencePolicy) {
          cadencePolicy = await this.cadenceStore.getCadencePolicy({
            workspaceId: params.workspaceId,
            segmentId: params.category,
            cadenceReferenceAt,
          });
          params.cadencePolicyBySegment.set(cadenceSegmentId, cadencePolicy);
        }

        minRetrySpacingMinutes = cadencePolicy.minSpacingMinutes;
        maxAttemptsPerDay = cadencePolicy.maxAttemptsPerDay;
      } catch (err: unknown) {
        this.logger.warn(
          "[QueuesService] failed to load cadence policy for suppression, using queue settings",
          {
            workspaceId: params.workspaceId,
            category: params.category,
            contactId: String(row.contact_id ?? ""),
          },
        );
        Sentry.captureException(err, {
          tags: {
            component: "QueuesService",
            operation: "getSuppressionReason",
          },
          extra: {
            workspaceId: params.workspaceId,
            category: params.category,
            contactId: String(row.contact_id ?? ""),
          },
        });
      }
    }

    if (
      minRetrySpacingMinutes &&
      lastAttemptAt &&
      Date.now() - lastAttemptAt.getTime() < minRetrySpacingMinutes * 60_000
    ) {
      return "MIN_RETRY_SPACING";
    }

    if (maxAttemptsPerDay && attemptsToday >= maxAttemptsPerDay) {
      return "MAX_ATTEMPTS_PER_DAY";
    }

    if (
      settings.maxAttemptsPerWeek &&
      attemptsThisWeek >= settings.maxAttemptsPerWeek
    ) {
      return "MAX_ATTEMPTS_PER_WEEK";
    }

    return null;
  }

  private async claimQueueItem(
    workspaceId: string,
    item: Record<string, unknown> | undefined,
  ) {
    try {
      if (!item?.id || !item.contact_id) {
        return null;
      }

      const isDoubleDial = String(item.retry_reason ?? "") === "double_dial";
      const hasRetryColumns = await this.hasQueueRetryColumns();
      const updatedRows = hasRetryColumns
        ? await this.dataSource.query(
            `UPDATE queue_items
             SET status = $1,
                 attempts = attempts + (CASE WHEN $3 THEN 0 ELSE 1 END),
                 last_attempt_at = NOW(),
                 retry_reason = CASE
                   WHEN $3 THEN 'double_dial_attempted'
                   ELSE retry_reason
                 END
             WHERE id = $2 AND status = 'pending'
             RETURNING *`,
            ["calling", item.id, isDoubleDial],
          )
        : await this.dataSource.query(
            `UPDATE queue_items
             SET status = $1,
                 attempts = attempts + (CASE WHEN $3 THEN 0 ELSE 1 END),
                 last_attempt_at = NOW()
             WHERE id = $2 AND status = 'pending'
             RETURNING *`,
            ["calling", item.id, isDoubleDial],
          );

      if (!updatedRows[0]) {
        return null;
      }

      if (!isDoubleDial) {
        await this.dataSource.query(
          `INSERT INTO contact_attempt_ledger (workspace_id, contact_id, last_attempt_at, attempts_total, attempts_today, attempts_this_week, outcomes, day_window_start, week_window_start)
           VALUES ($1, $2, NOW(), 1, 1, 1, '[]'::jsonb, date_trunc('day', NOW()), date_trunc('week', NOW()))
           ON CONFLICT (workspace_id, contact_id)
           DO UPDATE SET
             last_attempt_at = NOW(),
             attempts_total = contact_attempt_ledger.attempts_total + 1,
             attempts_today = CASE
               WHEN contact_attempt_ledger.day_window_start < date_trunc('day', NOW()) THEN 1
               ELSE contact_attempt_ledger.attempts_today + 1
             END,
             attempts_this_week = CASE
               WHEN contact_attempt_ledger.week_window_start < date_trunc('week', NOW()) THEN 1
               ELSE contact_attempt_ledger.attempts_this_week + 1
             END,
             day_window_start = CASE
               WHEN contact_attempt_ledger.day_window_start < date_trunc('day', NOW()) THEN date_trunc('day', NOW())
               ELSE contact_attempt_ledger.day_window_start
             END,
             week_window_start = CASE
               WHEN contact_attempt_ledger.week_window_start < date_trunc('week', NOW()) THEN date_trunc('week', NOW())
               ELSE contact_attempt_ledger.week_window_start
             END`,
          [workspaceId, item.contact_id],
        );
      }

      return this.unwrapRow(updatedRows[0]);
    } finally {
      // noop
    }
  }

  private async selectNextCallableItemWithoutLedger(
    queueId: string,
  ): Promise<QueueSelectionResult> {
    try {
      const rows = await this.dataSource.query(
        "SELECT * FROM queue_items WHERE queue_id = $1 AND status = 'pending' ORDER BY position ASC LIMIT 1 FOR UPDATE SKIP LOCKED",
        [queueId],
      );
      const item = rows[0];

      if (!item) {
        return { nextItem: null, suppression: null };
      }

      const updatedRows = await this.dataSource.query(
        "UPDATE queue_items SET status = $1, attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $2 AND status = 'pending' RETURNING *",
        ["calling", item.id],
      );

      return {
        nextItem: this.unwrapRow(updatedRows[0]),
        suppression: null,
        ranking: {
          index: 0,
          candidatesEvaluated: 1,
          selectionMethod: "fifo_fallback",
        },
      };
    } finally {
      // noop
    }
  }

  private isMissingRelationError(err: unknown, relationName: string) {
    return (
      err instanceof Error &&
      err.message.includes(`relation "${relationName}" does not exist`)
    );
  }

  private getQueueMaxAttempts(settings: QueueSettings) {
    if (typeof settings.maxAttempts === "number" && settings.maxAttempts > 0) {
      return settings.maxAttempts;
    }

    if (
      typeof settings.retryAttemptCap === "number" &&
      settings.retryAttemptCap > 0
    ) {
      return settings.retryAttemptCap;
    }

    return 3;
  }

  private getQueueLocalTimezone(settings: QueueSettings) {
    const timezoneValue = (settings as Record<string, unknown>).localTimezone;

    if (typeof timezoneValue === "string" && timezoneValue.length > 0) {
      return timezoneValue;
    }

    return "America/New_York";
  }

  private getCallableWindowEndHour(settings: QueueSettings) {
    const callableWindowEndHour = (settings as Record<string, unknown>)
      .callableWindowEndHour;

    if (
      typeof callableWindowEndHour === "number" &&
      Number.isFinite(callableWindowEndHour)
    ) {
      return Math.max(0, Math.min(Math.trunc(callableWindowEndHour), 23));
    }

    return 20;
  }

  private async updateQueueItemWithRetryFallback(
    queueItemId: string,
    status: "pending" | "completed",
    outcome: string | null,
    retryDecision: {
      retryStrategy: string;
      retryScheduledAt: string | null;
      retryReason: string | null;
    },
  ) {
    if (await this.hasQueueRetryColumns()) {
      return await this.dataSource.query(
        "UPDATE queue_items SET status = $1, call_outcome = $2, retry_strategy = $3, retry_scheduled_at = $4, retry_reason = $5 WHERE id = $6 RETURNING *",
        [
          status,
          outcome,
          retryDecision.retryStrategy,
          retryDecision.retryScheduledAt,
          retryDecision.retryReason,
          queueItemId,
        ],
      );
    }

    return await this.dataSource.query(
      "UPDATE queue_items SET status = $1, call_outcome = $2 WHERE id = $3 RETURNING *",
      [status, outcome, queueItemId],
    );
  }

  private async hasQueueRetryColumns() {
    if (this.queueRetryColumnsAvailable !== null) {
      return this.queueRetryColumnsAvailable;
    }

    const rows: Array<{ column_name: string }> = await this.dataSource.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'queue_items'
         AND column_name IN ('retry_strategy', 'retry_scheduled_at', 'retry_reason')`,
    );

    this.queueRetryColumnsAvailable = rows.length === 3;

    return this.queueRetryColumnsAvailable;
  }

  private unwrapRow<TRecord>(row: TRecord | TRecord[] | null | undefined) {
    if (Array.isArray(row)) {
      return row[0] ?? null;
    }

    return row ?? null;
  }
}
