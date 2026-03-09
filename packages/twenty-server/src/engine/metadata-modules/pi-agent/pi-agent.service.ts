import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

import {
  DatabaseSessionManager,
  createPiCrmTools,
  createContextInjection,
  createDialerTools,
  createKbTools,
  CrmClient,
  type AgentSessionData,
  type DialerService,
  type KbService,
} from '@consuelo/agent';
import type { AgentTool } from '@mariozechner/pi-agent-core';

const BASE_SYSTEM_PROMPT = 'You are a sales assistant for Consuelo.';

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
    options?: {
      crmClient?: CrmClient;
      dialerService?: DialerService;
      kbService?: KbService;
    },
  ): Promise<AgentSessionData> {
    try {
      const contextInjection = createContextInjection();
      const systemPrompt =
        BASE_SYSTEM_PROMPT + contextInjection.buildSystemPromptSuffix();

      const tools: AgentTool[] = [
        ...(options?.crmClient ? createPiCrmTools(options.crmClient) : []),
        ...(options?.dialerService ? createDialerTools(options.dialerService) : []),
        ...(options?.kbService ? createKbTools(options.kbService) : []),
      ];

      const session: AgentSessionData = {
        id: randomUUID(),
        workspaceId,
        userId,
        messages: [],
        systemPrompt,
        modelId: '',
        metadata: {
          toolNames: tools.map((t) => t.name),
        },
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
