// DEV-811: assistant conversation persistence — postgres CRUD + context window

import type { Pool } from 'pg';

// -- types --

export interface ConversationRow {
  id: string;
  workspace_id: string;
  user_id: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  commands_executed: unknown[] | null;
  created_at: string;
}

export interface ConversationContext {
  summary?: string;
  recentMessages: MessageRow[];
}

// -- SQL --

const SQL_CREATE_CONVERSATION = `
  INSERT INTO assistant_conversations (workspace_id, user_id)
  VALUES ($1, $2)
  RETURNING id, workspace_id, user_id, summary, created_at, updated_at`;

const SQL_GET_CONVERSATION = `
  SELECT id, workspace_id, user_id, summary, created_at, updated_at
  FROM assistant_conversations
  WHERE id = $1 AND workspace_id = $2`;

const SQL_LIST_CONVERSATIONS = `
  SELECT c.id, c.workspace_id, c.user_id, c.summary, c.created_at, c.updated_at,
    (SELECT content FROM assistant_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message
  FROM assistant_conversations c
  WHERE c.workspace_id = $1 AND c.user_id = $2
  ORDER BY c.updated_at DESC
  LIMIT 50`;

const SQL_DELETE_CONVERSATION = `
  DELETE FROM assistant_conversations
  WHERE id = $1 AND workspace_id = $2 AND user_id = $3`;

const SQL_TOUCH_CONVERSATION = `
  UPDATE assistant_conversations SET updated_at = NOW()
  WHERE id = $1`;

const SQL_UPDATE_SUMMARY = `
  UPDATE assistant_conversations SET summary = $2, updated_at = NOW()
  WHERE id = $1`;

const SQL_ADD_MESSAGE = `
  INSERT INTO assistant_messages (conversation_id, role, content, commands_executed)
  VALUES ($1, $2, $3, $4)
  RETURNING id, conversation_id, role, content, commands_executed, created_at`;

const SQL_RECENT_MESSAGES = `
  SELECT id, conversation_id, role, content, commands_executed, created_at
  FROM assistant_messages
  WHERE conversation_id = $1
  ORDER BY created_at DESC
  LIMIT $2`;

const SQL_MESSAGE_COUNT = `
  SELECT COUNT(*)::int AS count FROM assistant_messages WHERE conversation_id = $1`;

// -- service --

const CONTEXT_WINDOW_SIZE = 10;

export class AssistantConversationService {
  private pool: Pool | null = null;

  async getPool(): Promise<Pool> {
    try {
      if (!this.pool) {
        const { default: pg } = await import('pg');
        this.pool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
        });
      }
      return this.pool;
    } catch (err: unknown) {
      this.pool = null;
      throw err;
    }
  }

  async createConversation(workspaceId: string, userId: string): Promise<ConversationRow> {
    try {
      const pool = await this.getPool();
      const { rows } = await pool.query<ConversationRow>(SQL_CREATE_CONVERSATION, [workspaceId, userId]);
      return rows[0];
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('failed to create conversation');
    }
  }

  async getConversation(conversationId: string, workspaceId: string): Promise<ConversationRow | null> {
    try {
      const pool = await this.getPool();
      const { rows } = await pool.query<ConversationRow>(SQL_GET_CONVERSATION, [conversationId, workspaceId]);
      return rows[0] ?? null;
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('failed to get conversation');
    }
  }

  async listConversations(workspaceId: string, userId: string): Promise<Array<ConversationRow & { last_message?: string }>> {
    try {
      const pool = await this.getPool();
      const { rows } = await pool.query<ConversationRow & { last_message?: string }>(SQL_LIST_CONVERSATIONS, [workspaceId, userId]);
      return rows;
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('failed to list conversations');
    }
  }

  async deleteConversation(conversationId: string, workspaceId: string, userId: string): Promise<boolean> {
    try {
      const pool = await this.getPool();
      const { rowCount } = await pool.query(SQL_DELETE_CONVERSATION, [conversationId, workspaceId, userId]);
      return (rowCount ?? 0) > 0;
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('failed to delete conversation');
    }
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    commandsExecuted?: unknown[],
  ): Promise<MessageRow> {
    try {
      const pool = await this.getPool();
      const { rows } = await pool.query<MessageRow>(SQL_ADD_MESSAGE, [
        conversationId,
        role,
        content,
        commandsExecuted ? JSON.stringify(commandsExecuted) : null,
      ]);
      await pool.query(SQL_TOUCH_CONVERSATION, [conversationId]);
      return rows[0];
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('failed to add message');
    }
  }

  async getContext(conversationId: string): Promise<ConversationContext> {
    try {
      const pool = await this.getPool();
      const { rows: convRows } = await pool.query<ConversationRow>(
        'SELECT summary FROM assistant_conversations WHERE id = $1',
        [conversationId],
      );
      const summary = convRows[0]?.summary ?? undefined;
      const { rows: messages } = await pool.query<MessageRow>(SQL_RECENT_MESSAGES, [
        conversationId,
        CONTEXT_WINDOW_SIZE,
      ]);
      messages.reverse();
      return { summary, recentMessages: messages };
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('failed to get context');
    }
  }

  async updateSummary(conversationId: string, summary: string): Promise<void> {
    try {
      const pool = await this.getPool();
      await pool.query(SQL_UPDATE_SUMMARY, [conversationId, summary]);
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('failed to update summary');
    }
  }

  async getMessageCount(conversationId: string): Promise<number> {
    try {
      const pool = await this.getPool();
      const { rows } = await pool.query<{ count: number }>(SQL_MESSAGE_COUNT, [conversationId]);
      return rows[0]?.count ?? 0;
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('failed to get message count');
    }
  }
}
