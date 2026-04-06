import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

type QueueSettings = {
  minRetrySpacingMinutes?: number;
  maxAttemptsPerDay?: number;
  maxAttemptsPerWeek?: number;
};

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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
        'INSERT INTO call_queues (workspace_id, user_id, name, source_type, source_id, category, settings, total_contacts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [
          params.workspaceId,
          params.userId,
          params.name,
          params.sourceType ?? 'manual',
          params.sourceId ?? null,
          params.category ?? 'all',
          JSON.stringify(params.settings ?? {}),
          params.contactIds.length,
        ],
      );

      const queue = queueRows[0];

      if (params.contactIds.length > 0) {
        const valuesClause = params.contactIds
          .map((_, index) => `($1, $${index + 2}, ${index + 1})`)
          .join(',');

        await this.dataSource.query(
          `INSERT INTO queue_items (queue_id, contact_id, position) VALUES ${valuesClause}`,
          [queue.id, ...params.contactIds],
        );
      }

      return queue;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`createQueue failed: ${message}`, {
        workspaceId: params.workspaceId,
      });
      throw err;
    }
  }

  async listQueues(workspaceId: string) {
    try {
      return this.dataSource.query(
        'SELECT * FROM call_queues WHERE workspace_id = $1 ORDER BY created_at DESC',
        [workspaceId],
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`listQueues failed: ${message}`, { workspaceId });
      throw err;
    }
  }

  async getQueue(workspaceId: string, id: string) {
    try {
      const queueRows = await this.dataSource.query(
        'SELECT * FROM call_queues WHERE id = $1 AND workspace_id = $2',
        [id, workspaceId],
      );
      const queue = queueRows[0];

      if (!queue) {
        return null;
      }

      const items = await this.dataSource.query(
        'SELECT * FROM queue_items WHERE queue_id = $1 ORDER BY position ASC',
        [id],
      );

      return { ...queue, items };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`getQueue failed: ${message}`, { workspaceId, id });
      throw err;
    }
  }

  async updateQueueStatus(workspaceId: string, id: string, status: string) {
    try {
      const rows = await this.dataSource.query(
        'UPDATE call_queues SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *',
        [status, id, workspaceId],
      );

      return rows[0] ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

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
        'UPDATE call_queues SET status = $1, started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *',
        ['active', id, workspaceId],
      );

      const queue = queueRows[0];

      if (!queue) {
        return null;
      }

      const item = await this.selectNextCallableItem(id, workspaceId);

      return { queue, currentItem: item, nextItem: item };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`startQueue failed: ${message}`, { workspaceId, id });
      throw err;
    }
  }

  async skipCurrentItem(params: { queueId: string; workspaceId: string }) {
    try {
      const queueCheck = await this.dataSource.query(
        'SELECT id FROM call_queues WHERE id = $1 AND workspace_id = $2',
        [params.queueId, params.workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      const currentRows = await this.dataSource.query(
        'SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 ORDER BY position ASC LIMIT 1 FOR UPDATE SKIP LOCKED',
        [params.queueId, 'calling'],
      );
      const current = currentRows[0];

      if (!current) {
        return {
          current: null,
          nextItem: await this.selectNextCallableItem(
            params.queueId,
            params.workspaceId,
          ),
        };
      }

      const updatedRows = await this.dataSource.query(
        'UPDATE queue_items SET status = $1, skip_reason = $2 WHERE id = $3 RETURNING *',
        ['skipped', 'user_skip', current.id],
      );

      return {
        current: updatedRows[0],
        nextItem: await this.selectNextCallableItem(
          params.queueId,
          params.workspaceId,
        ),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

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
  }) {
    try {
      const queueCheck = await this.dataSource.query(
        'SELECT id FROM call_queues WHERE id = $1 AND workspace_id = $2',
        [params.queueId, params.workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      const currentRows = await this.dataSource.query(
        'SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 ORDER BY position ASC LIMIT 1 FOR UPDATE SKIP LOCKED',
        [params.queueId, 'calling'],
      );
      const current = currentRows[0];

      if (!current) {
        return {
          current: null,
          nextItem: await this.selectNextCallableItem(
            params.queueId,
            params.workspaceId,
          ),
        };
      }

      const updatedRows = await this.dataSource.query(
        'UPDATE queue_items SET status = $1, call_outcome = $2 WHERE id = $3 RETURNING *',
        ['completed', params.outcome ?? null, current.id],
      );

      return {
        current: updatedRows[0],
        nextItem: await this.selectNextCallableItem(
          params.queueId,
          params.workspaceId,
        ),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

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
        'SELECT id FROM call_queues WHERE id = $1 AND workspace_id = $2',
        [id, workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      await this.dataSource.query(
        'UPDATE queue_items SET status = $1, attempts = 0, call_outcome = NULL, skip_reason = NULL WHERE queue_id = $2',
        ['pending', id],
      );

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`restartQueue failed: ${message}`, { workspaceId, id });
      throw err;
    }
  }

  async assignQueue(workspaceId: string, id: string, userId: string) {
    try {
      const rows = await this.dataSource.query(
        'UPDATE call_queues SET user_id = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *',
        [userId, id, workspaceId],
      );

      return rows[0] ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`assignQueue failed: ${message}`, { workspaceId, id });
      throw err;
    }
  }

  async queueAnalytics(workspaceId: string, queueId: string) {
    try {
      const queueCheck = await this.dataSource.query(
        'SELECT id FROM call_queues WHERE id = $1 AND workspace_id = $2',
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
        'SELECT status, call_outcome, call_duration_seconds FROM queue_items WHERE queue_id = $1',
        [queueId],
      );

      const total = rows.length;
      const completed = rows.filter((row) => row.status === 'completed').length;
      const skipped = rows.filter((row) => row.status === 'skipped').length;
      const rowsWithDuration = rows.filter(
        (row) => typeof row.call_duration_seconds === 'number',
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
          const key = row.call_outcome ?? 'unknown';

          acc[key] = (acc[key] ?? 0) + 1;

          return acc;
        }, {}),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`queueAnalytics failed: ${message}`, {
        workspaceId,
        queueId,
      });
      throw err;
    }
  }

  private sanitizeCsvValue(value: string): string {
    const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
    let sanitized = value;

    if (formulaChars.some((char) => sanitized.startsWith(char))) {
      sanitized = `'${sanitized}`;
    }

    return sanitized.split('"').join('""');
  }

  async exportQueueCsv(workspaceId: string, queueId: string) {
    try {
      const queueCheck = await this.dataSource.query(
        'SELECT id FROM call_queues WHERE id = $1 AND workspace_id = $2',
        [queueId, workspaceId],
      );

      if (!queueCheck[0]) {
        return null;
      }

      const rows = await this.dataSource.query(
        `SELECT qi.id, qi.position, qi.status, qi.call_outcome, qi.attempts, c.name, c.phone
         FROM queue_items qi
         LEFT JOIN contacts c ON c.id = qi.contact_id
         WHERE qi.queue_id = $1
         ORDER BY qi.position ASC`,
        [queueId],
      );

      const header = 'id,position,status,call_outcome,attempts,name,phone';
      const lines = rows.map((row: Record<string, unknown>) => {
        const values = [
          row.id,
          row.position,
          row.status,
          row.call_outcome ?? '',
          row.attempts,
          this.sanitizeCsvValue(String(row.name ?? '')),
          this.sanitizeCsvValue(String(row.phone ?? '')),
        ];

        return values.map((value) => `"${value}"`).join(',');
      });

      return [header, ...lines].join('\n');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';

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
        'SELECT id, name, phone FROM contacts WHERE id = $1 AND workspace_id = $2',
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
      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`getContactDialerInfo failed: ${message}`, {
        workspaceId,
        contactId,
      });
      throw err;
    }
  }

  private async selectNextCallableItem(queueId: string, workspaceId: string) {
    try {
      const queueRows = await this.dataSource.query(
        'SELECT settings FROM call_queues WHERE id = $1 AND workspace_id = $2',
        [queueId, workspaceId],
      );
      const settings = (queueRows[0]?.settings ?? {}) as QueueSettings;

      const rows = await this.dataSource.query(
        `SELECT qi.id, qi.contact_id, qi.position, ledger.last_attempt_at, ledger.attempts_today, ledger.attempts_this_week,
                ledger.day_window_start, ledger.week_window_start
         FROM queue_items qi
         LEFT JOIN contact_attempt_ledger ledger ON ledger.workspace_id = $2 AND ledger.contact_id = qi.contact_id
         WHERE qi.queue_id = $1 AND qi.status = 'pending'
         ORDER BY qi.position ASC
         FOR UPDATE SKIP LOCKED`,
        [queueId, workspaceId],
      );

      const item = rows.find((row: Record<string, unknown>) => {
        const lastAttemptAt = row.last_attempt_at
          ? new Date(String(row.last_attempt_at))
          : null;
        const attemptsToday = Number(row.attempts_today ?? 0);
        const attemptsThisWeek = Number(row.attempts_this_week ?? 0);

        if (
          settings.minRetrySpacingMinutes &&
          lastAttemptAt &&
          Date.now() - lastAttemptAt.getTime() <
            settings.minRetrySpacingMinutes * 60_000
        ) {
          return false;
        }

        if (
          settings.maxAttemptsPerDay &&
          attemptsToday >= settings.maxAttemptsPerDay
        ) {
          return false;
        }

        if (
          settings.maxAttemptsPerWeek &&
          attemptsThisWeek >= settings.maxAttemptsPerWeek
        ) {
          return false;
        }

        return true;
      });

      return await this.claimQueueItem(workspaceId, item);
    } catch (err: unknown) {
      if (this.isMissingRelationError(err, 'contact_attempt_ledger')) {
        return await this.selectNextCallableItemWithoutLedger(queueId);
      }

      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error(`selectNextCallableItem failed: ${message}`, {
        queueId,
        workspaceId,
      });
      throw err;
    }
  }

  private async claimQueueItem(
    workspaceId: string,
    item: Record<string, unknown> | undefined,
  ) {
    try {
      if (!item?.id || !item.contact_id) {
        return null;
      }

      const updatedRows = await this.dataSource.query(
        "UPDATE queue_items SET status = $1, attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $2 AND status = 'pending' RETURNING *",
        ['calling', item.id],
      );

      if (!updatedRows[0]) {
        return null;
      }

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

      return updatedRows[0];
    } finally {
      // noop
    }
  }

  private async selectNextCallableItemWithoutLedger(queueId: string) {
    try {
      const rows = await this.dataSource.query(
        "SELECT * FROM queue_items WHERE queue_id = $1 AND status = 'pending' ORDER BY position ASC LIMIT 1 FOR UPDATE SKIP LOCKED",
        [queueId],
      );
      const item = rows[0];

      if (!item) {
        return null;
      }

      const updatedRows = await this.dataSource.query(
        "UPDATE queue_items SET status = $1, attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $2 AND status = 'pending' RETURNING *",
        ['calling', item.id],
      );

      return updatedRows[0] ?? null;
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
}
