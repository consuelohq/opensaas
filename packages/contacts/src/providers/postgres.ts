import type { Contact, Queue, StorageProvider } from '../types.js';
import * as Sentry from '@sentry/node';

type Pool = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
};

export class PostgresStorageProvider implements StorageProvider {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createContact(
    data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Contact> {
    try {
      const now = new Date().toISOString();
      const result = await this.pool.query(
        'INSERT INTO contacts (workspace_id, name, phone, email, company, tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [
          data.workspaceId ?? '',
          data.name,
          data.phone,
          data.email ?? null,
          data.company ?? null,
          data.tags ?? [],
          now,
          now,
        ],
      );
      return this.rowToContact(result.rows[0]);
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] createContact failed: ${message}`,
      );
    }
  }

  async getContact(id: string): Promise<Contact | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM contacts WHERE id = $1',
        [id],
      );
      return result.rows.length > 0 ? this.rowToContact(result.rows[0]) : null;
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] getContact failed: ${message}`,
      );
    }
  }

  async updateContact(
    id: string,
    data: Partial<Contact>,
  ): Promise<Contact | null> {
    try {
      const existing = await this.getContact(id);
      if (!existing) return null;

      const now = new Date().toISOString();
      const updates: string[] = ['updated_at = $1'];
      const values: unknown[] = [now];
      let paramIndex = 2;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(data.phone);
      }
      if (data.email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(data.email);
      }
      if (data.company !== undefined) {
        updates.push(`company = $${paramIndex++}`);
        values.push(data.company);
      }
      if (data.tags !== undefined) {
        updates.push(`tags = $${paramIndex++}`);
        values.push(data.tags);
      }

      values.push(id);
      const sql = `UPDATE contacts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await this.pool.query(sql, values);
      return result.rows.length > 0 ? this.rowToContact(result.rows[0]) : null;
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] updateContact failed: ${message}`,
      );
    }
  }

  async deleteContact(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM contacts WHERE id = $1',
        [id],
      );
      return (result.rowCount ?? 0) > 0;
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] deleteContact failed: ${message}`,
      );
    }
  }

  async searchContacts(query: string, workspaceId?: string): Promise<Contact[]> {
    try {
      const searchPattern = `%${query}%`;
      let sql: string;
      let params: unknown[];

      if (workspaceId) {
        sql = `SELECT * FROM contacts
               WHERE workspace_id = $1
               AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)`;
        params = [workspaceId, searchPattern];
      } else {
        sql = `SELECT * FROM contacts
               WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1`;
        params = [searchPattern];
      }

      const result = await this.pool.query(sql, params);
      return result.rows.map((row) => this.rowToContact(row));
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] searchContacts failed: ${message}`,
      );
    }
  }

  async listContacts(workspaceId: string): Promise<Contact[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM contacts WHERE workspace_id = $1 ORDER BY created_at DESC',
        [workspaceId],
      );
      return result.rows.map((row) => this.rowToContact(row));
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] listContacts failed: ${message}`,
      );
    }
  }

  async createQueue(data: Omit<Queue, 'id' | 'createdAt'>): Promise<Queue> {
    try {
      const now = new Date().toISOString();
      const result = await this.pool.query(
        'INSERT INTO queues (name, contact_ids, ordering, current_index, status, results, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [
          data.name,
          JSON.stringify(data.contactIds),
          data.ordering,
          data.currentIndex,
          data.status,
          JSON.stringify(data.results),
          now,
        ],
      );
      return this.rowToQueue(result.rows[0]);
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] createQueue failed: ${message}`,
      );
    }
  }

  async getQueue(id: string): Promise<Queue | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM queues WHERE id = $1',
        [id],
      );
      return result.rows.length > 0 ? this.rowToQueue(result.rows[0]) : null;
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`[PostgresStorageProvider] getQueue failed: ${message}`);
    }
  }

  async updateQueue(id: string, data: Partial<Queue>): Promise<Queue | null> {
    try {
      const existing = await this.getQueue(id);
      if (!existing) return null;

      const now = new Date().toISOString();
      const updates: string[] = ['updated_at = $1'];
      const values: unknown[] = [now];
      let paramIndex = 2;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.contactIds !== undefined) {
        updates.push(`contact_ids = $${paramIndex++}`);
        values.push(JSON.stringify(data.contactIds));
      }
      if (data.ordering !== undefined) {
        updates.push(`ordering = $${paramIndex++}`);
        values.push(data.ordering);
      }
      if (data.currentIndex !== undefined) {
        updates.push(`current_index = $${paramIndex++}`);
        values.push(data.currentIndex);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }
      if (data.results !== undefined) {
        updates.push(`results = $${paramIndex++}`);
        values.push(JSON.stringify(data.results));
      }

      values.push(id);
      const sql = `UPDATE queues SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await this.pool.query(sql, values);
      return result.rows.length > 0 ? this.rowToQueue(result.rows[0]) : null;
    } catch (err: unknown) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] updateQueue failed: ${message}`,
      );
    }
  }

  private rowToContact(row: Record<string, unknown>): Contact {
    return {
      id: String(row.id),
      workspaceId: row.workspace_id != null ? String(row.workspace_id) : undefined,
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      email: row.email != null ? String(row.email) : undefined,
      company: row.company != null ? String(row.company) : undefined,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private rowToQueue(row: Record<string, unknown>): Queue {
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      contactIds: JSON.parse(String(row.contact_ids ?? '[]')) as string[],
      ordering: String(row.ordering) as Queue['ordering'],
      currentIndex: Number(row.current_index ?? 0),
      status: String(row.status) as Queue['status'],
      results: JSON.parse(String(row.results ?? '[]')) as Queue['results'],
      createdAt: String(row.created_at),
    };
  }
}
