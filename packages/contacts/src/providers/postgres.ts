import type { Contact, Queue, StorageProvider } from '../types.js';

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
        `INSERT INTO contacts (name, phone, email, company, tags, custom_fields, user_id, org_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          data.name,
          data.phone,
          data.email ?? null,
          data.company ?? null,
          data.tags ? JSON.stringify(data.tags) : null,
          data.customFields ? JSON.stringify(data.customFields) : null,
          data.userId ?? null,
          data.orgId ?? null,
          now,
          now,
        ],
      );
      return this.rowToContact(result.rows[0]);
    } catch (err: unknown) {
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
      const result = await this.pool.query(
        `UPDATE contacts
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             company = COALESCE($4, company),
             tags = COALESCE($5, tags),
             custom_fields = COALESCE($6, custom_fields),
             user_id = COALESCE($7, user_id),
             org_id = COALESCE($8, org_id),
             updated_at = $9
         WHERE id = $10
         RETURNING *`,
        [
          data.name ?? null,
          data.phone ?? null,
          data.email ?? null,
          data.company ?? null,
          data.tags ? JSON.stringify(data.tags) : null,
          data.customFields ? JSON.stringify(data.customFields) : null,
          data.userId ?? null,
          data.orgId ?? null,
          now,
          id,
        ],
      );
      return result.rows.length > 0 ? this.rowToContact(result.rows[0]) : null;
    } catch (err: unknown) {
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
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] deleteContact failed: ${message}`,
      );
    }
  }

  async searchContacts(query: string, userId?: string): Promise<Contact[]> {
    try {
      const searchPattern = `%${query}%`;
      let sql: string;
      let params: unknown[];

      if (userId) {
        sql = `SELECT * FROM contacts
               WHERE user_id = $1
               AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)`;
        params = [userId, searchPattern];
      } else {
        sql = `SELECT * FROM contacts
               WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1`;
        params = [searchPattern];
      }

      const result = await this.pool.query(sql, params);
      return result.rows.map((row) => this.rowToContact(row));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] searchContacts failed: ${message}`,
      );
    }
  }

  async listContacts(userId: string): Promise<Contact[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC',
        [userId],
      );
      return result.rows.map((row) => this.rowToContact(row));
    } catch (err: unknown) {
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
        `INSERT INTO queues (name, contact_ids, ordering, current_index, status, results, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
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
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`[PostgresStorageProvider] getQueue failed: ${message}`);
    }
  }

  async updateQueue(id: string, data: Partial<Queue>): Promise<Queue | null> {
    try {
      const existing = await this.getQueue(id);
      if (!existing) return null;

      const result = await this.pool.query(
        `UPDATE queues
         SET name = COALESCE($1, name),
             contact_ids = COALESCE($2, contact_ids),
             ordering = COALESCE($3, ordering),
             current_index = COALESCE($4, current_index),
             status = COALESCE($5, status),
             results = COALESCE($6, results)
         WHERE id = $7
         RETURNING *`,
        [
          data.name ?? null,
          data.contactIds ? JSON.stringify(data.contactIds) : null,
          data.ordering ?? null,
          data.currentIndex ?? null,
          data.status ?? null,
          data.results ? JSON.stringify(data.results) : null,
          id,
        ],
      );
      return result.rows.length > 0 ? this.rowToQueue(result.rows[0]) : null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `[PostgresStorageProvider] updateQueue failed: ${message}`,
      );
    }
  }

  private rowToContact(row: Record<string, unknown>): Contact {
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      email: row.email != null ? String(row.email) : undefined,
      company: row.company != null ? String(row.company) : undefined,
      tags:
        row.tags != null
          ? (JSON.parse(String(row.tags)) as string[])
          : undefined,
      customFields:
        row.custom_fields != null
          ? (JSON.parse(String(row.custom_fields)) as Record<string, string>)
          : undefined,
      userId: row.user_id != null ? String(row.user_id) : undefined,
      orgId: row.org_id != null ? String(row.org_id) : undefined,
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
