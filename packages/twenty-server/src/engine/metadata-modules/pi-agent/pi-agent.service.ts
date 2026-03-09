import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

import {
  DatabaseSessionManager,
  type AgentSessionData,
} from '@consuelo/agent';

@Injectable()
export class PiAgentService {
  private readonly sessionManager: DatabaseSessionManager;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.sessionManager = new DatabaseSessionManager(this.dataSource);
  }

  async createSession(
    userId: string,
    workspaceId: string,
  ): Promise<AgentSessionData> {
    try {
      const session: AgentSessionData = {
        id: randomUUID(),
        workspaceId,
        userId,
        messages: [],
        systemPrompt: '',
        modelId: '',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.sessionManager.save(session);

      return session;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error creating session';
      throw new Error(`PiAgentService.createSession failed: ${message}`);
    }
  }

  async loadSession(sessionId: string): Promise<AgentSessionData | null> {
    try {
      return await this.sessionManager.load(sessionId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error loading session';
      throw new Error(`PiAgentService.loadSession failed: ${message}`);
    }
  }

  async listSessions(
    userId: string,
    workspaceId: string,
  ): Promise<AgentSessionData[]> {
    try {
      return await this.sessionManager.list(userId, workspaceId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error listing sessions';
      throw new Error(`PiAgentService.listSessions failed: ${message}`);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.sessionManager.delete(sessionId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error deleting session';
      throw new Error(`PiAgentService.deleteSession failed: ${message}`);
    }
  }
}
