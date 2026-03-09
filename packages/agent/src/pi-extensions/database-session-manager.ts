// postgres-backed session manager for pi agent sessions
// pi-agent-core doesn't provide a SessionManager interface,
// so we define our own for multi-tenant SaaS persistence

import type { AgentMessage } from '@mariozechner/pi-agent-core';

export type AgentSessionData = {
  id: string;
  workspaceId: string;
  userId: string;
  messages: AgentMessage[];
  systemPrompt: string;
  modelId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// minimal db interface — accepts TypeORM DataSource or any pg client with query()
export type DatabaseConnection = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] } | Record<string, unknown>[]>;
};

export type SessionManager = {
  save(session: AgentSessionData): Promise<void>;
  load(sessionId: string): Promise<AgentSessionData | null>;
  list(userId: string, workspaceId: string): Promise<AgentSessionData[]>;
  delete(sessionId: string): Promise<void>;
};

export class DatabaseSessionManager implements SessionManager {
  constructor(private readonly db: DatabaseConnection) {}

  async save(session: AgentSessionData): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO "core"."agentSession" (id, "workspaceId", "userId", data, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET data = $4, "updatedAt" = NOW()`,
        [
          session.id,
          session.workspaceId,
          session.userId,
          JSON.stringify({
            messages: session.messages,
            systemPrompt: session.systemPrompt,
            modelId: session.modelId,
            metadata: session.metadata,
          }),
        ],
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error saving session';
      throw new Error(`DatabaseSessionManager.save failed: ${message}`);
    }
  }

  async load(sessionId: string): Promise<AgentSessionData | null> {
    try {
      const result = await this.db.query(
        `SELECT id, "workspaceId", "userId", data, "createdAt", "updatedAt"
         FROM "core"."agentSession" WHERE id = $1`,
        [sessionId],
      );

      const rows = Array.isArray(result) ? result : result.rows;
      const row = rows[0];

      if (!row) {
        return null;
      }

      const data =
        typeof row.data === 'string'
          ? JSON.parse(row.data)
          : (row.data as Record<string, unknown>);

      return {
        id: row.id as string,
        workspaceId: row.workspaceId as string,
        userId: row.userId as string,
        messages: (data.messages ?? []) as AgentMessage[],
        systemPrompt: (data.systemPrompt ?? '') as string,
        modelId: (data.modelId ?? '') as string,
        metadata: (data.metadata ?? {}) as Record<string, unknown>,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error loading session';
      throw new Error(`DatabaseSessionManager.load failed: ${message}`);
    }
  }

  async list(
    userId: string,
    workspaceId: string,
  ): Promise<AgentSessionData[]> {
    try {
      const result = await this.db.query(
        `SELECT id, "workspaceId", "userId", data, "createdAt", "updatedAt"
         FROM "core"."agentSession"
         WHERE "userId" = $1 AND "workspaceId" = $2
         ORDER BY "updatedAt" DESC`,
        [userId, workspaceId],
      );

      const rows = Array.isArray(result) ? result : result.rows;
      return rows.map((row) => {
        const data =
          typeof row.data === 'string'
            ? JSON.parse(row.data)
            : (row.data as Record<string, unknown>);

        return {
          id: row.id as string,
          workspaceId: row.workspaceId as string,
          userId: row.userId as string,
          messages: (data.messages ?? []) as AgentMessage[],
          systemPrompt: (data.systemPrompt ?? '') as string,
          modelId: (data.modelId ?? '') as string,
          metadata: (data.metadata ?? {}) as Record<string, unknown>,
          createdAt: String(row.createdAt),
          updatedAt: String(row.updatedAt),
        };
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error listing sessions';
      throw new Error(`DatabaseSessionManager.list failed: ${message}`);
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await this.db.query(
        `DELETE FROM "core"."agentSession" WHERE id = $1`,
        [sessionId],
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error deleting session';
      throw new Error(`DatabaseSessionManager.delete failed: ${message}`);
    }
  }
}
