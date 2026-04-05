import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type QueueSettings = {
  minRetrySpacingMinutes?: number;
  maxAttemptsPerDay?: number;
  maxAttemptsPerWeek?: number;
};

@Injectable()
export class QueuesService {
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
    const queueRows = await this.dataSource.query(
      'INSERT INTO call_queues (workspace_id, user_id, name, source_type, source_id, category, settings, total_contacts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [
        params.workspaceId,
        params.userId,
        params.name,
        params.sourceType ?? null,
        params.sourceId ?? null,
        params.category ?? null,
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
  }

  async listQueues(workspaceId: string) {
    return this.dataSource.query(
      'SELECT * FROM call_queues WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId],
    );
  }

  async getQueue(workspaceId: string, id: string) {
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
  }

  async updateQueueStatus(workspaceId: string, id: string, status: string) {
    const rows = await this.dataSource.query(
      'UPDATE call_queues SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *',
      [status, id, workspaceId],
    );

    return rows[0] ?? null;
  }

  async startQueue(workspaceId: string, id: string) {
    const queueRows = await this.dataSource.query(
      'UPDATE call_queues SET status = $1, started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *',
      ['active', id, workspaceId],
    );

    const queue = queueRows[0];
    if (!queue) {
      return null;
    }

    const item = await this.selectNextCallableItem(id, workspaceId);

    return { queue, nextItem: item };
  }

  async skipCurrentItem(queueId: string, workspaceId: string, reason?: string) {
    const currentRows = await this.dataSource.query(
      'SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 ORDER BY position ASC LIMIT 1',
      [queueId, 'calling'],
    );
    const current = currentRows[0];

    if (!current) {
      return { skipped: null, nextItem: await this.selectNextCallableItem(queueId, workspaceId) };
    }

    const updatedRows = await this.dataSource.query(
      'UPDATE queue_items SET status = $1, skip_reason = $2 WHERE id = $3 RETURNING *',
      ['skipped', reason ?? null, current.id],
    );

    await this.dataSource.query(
      'UPDATE call_queues SET skipped_contacts = skipped_contacts + 1, updated_at = NOW() WHERE id = $1',
      [queueId],
    );

    const nextItem = await this.selectNextCallableItem(queueId, workspaceId);

    return { skipped: updatedRows[0], nextItem };
  }

  async completeCurrentAndAdvance(params: {
    queueId: string;
    workspaceId: string;
    outcome?: string;
  }) {
    const currentRows = await this.dataSource.query(
      'SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 ORDER BY position ASC LIMIT 1',
      [params.queueId, 'calling'],
    );
    const current = currentRows[0];

    if (!current) {
      return { current: null, nextItem: await this.selectNextCallableItem(params.queueId, params.workspaceId) };
    }

    const updatedRows = await this.dataSource.query(
      'UPDATE queue_items SET status = $1, call_outcome = $2 WHERE id = $3 RETURNING *',
      ['completed', params.outcome ?? null, current.id],
    );

    return {
      current: updatedRows[0],
      nextItem: await this.selectNextCallableItem(params.queueId, params.workspaceId),
    };
  }

  async restartQueue(id: string) {
    await this.dataSource.query(
      'UPDATE queue_items SET status = $1, attempts = 0, call_outcome = NULL, skip_reason = NULL WHERE queue_id = $2',
      ['pending', id],
    );
  }

  async assignQueue(workspaceId: string, id: string, userId: string) {
    const rows = await this.dataSource.query(
      'UPDATE call_queues SET user_id = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *',
      [userId, id, workspaceId],
    );

    return rows[0] ?? null;
  }

  async queueAnalytics(queueId: string) {
    const rows: Array<{ status: string; call_outcome: string | null; call_duration_seconds: number | null }> = await this.dataSource.query(
      'SELECT status, call_outcome, call_duration_seconds FROM queue_items WHERE queue_id = $1',
      [queueId],
    );

    const total = rows.length;
    const completed = rows.filter((row) => row.status === 'completed').length;
    const skipped = rows.filter((row) => row.status === 'skipped').length;
    const avgDurationSeconds = rows
      .filter((row) => typeof row.call_duration_seconds === 'number')
      .reduce((acc, row) => acc + (row.call_duration_seconds ?? 0), 0);

    return {
      total,
      completed,
      skipped,
      completionRate: total === 0 ? 0 : completed / total,
      avgDurationSeconds:
        completed === 0 ? 0 : Math.round(avgDurationSeconds / completed),
      outcomes: rows.reduce<Record<string, number>>((acc, row) => {
        const key = row.call_outcome ?? 'unknown';
        acc[key] = (acc[key] ?? 0) + 1;

        return acc;
      }, {}),
    };
  }

  async exportQueueCsv(queueId: string) {
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
        row.name ?? '',
        row.phone ?? '',
      ];

      return values
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(',');
    });

    return [header, ...lines].join('\n');
  }

  async getContactDialerInfo(contactId: string) {
    const contactRows = await this.dataSource.query(
      'SELECT id, name, phone FROM contacts WHERE id = $1',
      [contactId],
    );

    const attempts = await this.dataSource.query(
      'SELECT id, call_outcome, call_duration_seconds, created_at FROM queue_items WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 20',
      [contactId],
    );

    return {
      contact: contactRows[0] ?? null,
      attempts,
    };
  }

  private async selectNextCallableItem(queueId: string, workspaceId: string) {
    const queueRows = await this.dataSource.query(
      'SELECT settings FROM call_queues WHERE id = $1 AND workspace_id = $2',
      [queueId, workspaceId],
    );
    const settings = (queueRows[0]?.settings ?? {}) as QueueSettings;

    const rows = await this.dataSource.query(
      `SELECT qi.*, ledger.last_attempt_at, ledger.attempts_today, ledger.attempts_this_week
       FROM queue_items qi
       LEFT JOIN contact_attempt_ledger ledger ON ledger.workspace_id = $2 AND ledger.contact_id = qi.contact_id
       WHERE qi.queue_id = $1 AND qi.status = 'pending'
       ORDER BY qi.position ASC`,
      [queueId, workspaceId],
    );

    const item = rows.find((row: Record<string, unknown>) => {
      const lastAttemptAt = row.last_attempt_at ? new Date(String(row.last_attempt_at)) : null;
      const attemptsToday = Number(row.attempts_today ?? 0);
      const attemptsThisWeek = Number(row.attempts_this_week ?? 0);

      if (
        settings.minRetrySpacingMinutes &&
        lastAttemptAt &&
        Date.now() - lastAttemptAt.getTime() < settings.minRetrySpacingMinutes * 60_000
      ) {
        return false;
      }

      if (settings.maxAttemptsPerDay && attemptsToday >= settings.maxAttemptsPerDay) {
        return false;
      }

      if (settings.maxAttemptsPerWeek && attemptsThisWeek >= settings.maxAttemptsPerWeek) {
        return false;
      }

      return true;
    });

    if (!item) {
      return null;
    }

    const updatedRows = await this.dataSource.query(
      'UPDATE queue_items SET status = $1, attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $2 RETURNING *',
      ['calling', item.id],
    );

    await this.dataSource.query(
      `INSERT INTO contact_attempt_ledger (workspace_id, contact_id, last_attempt_at, attempts_total, attempts_today, attempts_this_week, outcomes, day_window_start, week_window_start)
       VALUES ($1, $2, NOW(), 1, 1, 1, '[]'::jsonb, date_trunc('day', NOW()), date_trunc('week', NOW()))
       ON CONFLICT (workspace_id, contact_id)
       DO UPDATE SET
         last_attempt_at = NOW(),
         attempts_total = contact_attempt_ledger.attempts_total + 1,
         attempts_today = contact_attempt_ledger.attempts_today + 1,
         attempts_this_week = contact_attempt_ledger.attempts_this_week + 1`,
      [workspaceId, item.contact_id],
    );

    return updatedRows[0] ?? null;
  }
}
