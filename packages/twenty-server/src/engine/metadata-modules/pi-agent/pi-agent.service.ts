import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

import {
  DatabaseSessionManager,
  createPiCrmTools,
  createContextInjection,
  createPipelineIntelligence,
  createDialerTools,
  createKbTools,
  createPreferenceInference,
  createTurnGrading,
  CrmClient,
  type AgentSessionData,
  type ContextInjection,
  type PipelineIntelligence,
  type AfterTurnExtension,
  type DialerService,
  type KbService,
  type ContextLoader,
  type MemoryStore,
  type ExecutionStore,
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
      contextLoader?: ContextLoader;
      dialerService?: DialerService;
      kbService?: KbService;
      memoryStore?: MemoryStore;
      executionStore?: ExecutionStore;
    },
  ): Promise<AgentSessionData> {
    try {
      // build before-turn extensions
      const extensions: Array<ContextInjection | PipelineIntelligence> = [];

      if (options?.contextLoader) {
        extensions.push(
          createContextInjection(options.contextLoader, userId, workspaceId),
        );
      }

      if (options?.crmClient) {
        extensions.push(createPipelineIntelligence(options.crmClient));
      }

      // build after-turn extensions
      const afterTurnExtensions: AfterTurnExtension[] = [];

      if (options?.memoryStore) {
        afterTurnExtensions.push(
          createPreferenceInference(options.memoryStore),
        );
      }

      if (options?.executionStore) {
        afterTurnExtensions.push(
          createTurnGrading(options.executionStore),
        );
      }

      const systemPrompt = BASE_SYSTEM_PROMPT;

      const tools: AgentTool[] = [
        ...(options?.crmClient ? createPiCrmTools(options.crmClient) : []),
        ...(options?.dialerService
          ? createDialerTools(options.dialerService)
          : []),
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
          hasContextInjection: !!options?.contextLoader,
          hasPipelineIntelligence: !!options?.crmClient,
          hasPreferenceInference: !!options?.memoryStore,
          hasTurnGrading: !!options?.executionStore,
          extensionCount: extensions.length,
          afterTurnExtensionCount: afterTurnExtensions.length,
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
