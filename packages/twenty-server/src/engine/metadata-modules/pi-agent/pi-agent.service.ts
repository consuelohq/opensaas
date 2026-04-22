import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';

import { DataSource } from 'typeorm';

import type {
  AgentSessionData,
  ChatResult,
  ContextInjection,
  PipelineIntelligence,
  AfterTurnExtension,
  DialerService,
  KbService,
  ContextLoader,
  MemoryStore,
  ExecutionStore,
  UsageStore,
  PhoneNumberRecommendationService,
  PiSession,
  PiStreamEvent,
  ChatRequest,
  AgentContext,
  CrmClient,
} from '@consuelo/agent';
import type { AgentTool } from '@mariozechner/pi-agent-core';

import {
  type ChatExecutionOptions,
  ChatExecutionService,
} from 'src/engine/metadata-modules/ai/ai-chat/services/chat-execution.service';

const BASE_SYSTEM_PROMPT = 'You are a sales assistant for Consuelo.';

// adapt AI SDK's streamText into a PiSession by converting fullStream parts
function createPiSessionFromAiSdk(
  chatExecutionService: ChatExecutionService,
  executionOptions: ChatExecutionOptions,
): PiSession {
  return {
    async *prompt(
      _message: string,
      _options?: { signal?: AbortSignal },
    ): AsyncIterable<PiStreamEvent> {
      const { stream } =
        await chatExecutionService.streamChat(executionOptions);

      for await (const part of stream.fullStream) {
        switch (part.type) {
          case 'text-delta':
            yield { type: 'text_delta', text: part.text };
            break;
          case 'tool-call':
            yield {
              type: 'tool_call_start',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.input as Record<string, unknown>,
            };
            break;
          case 'tool-result':
            yield {
              type: 'tool_call_result',
              toolCallId: part.toolCallId,
              result: part.output,
            };
            break;
          case 'finish':
            yield {
              type: 'usage',
              inputTokens: part.totalUsage?.inputTokens ?? 0,
              outputTokens: part.totalUsage?.outputTokens ?? 0,
            };
            yield { type: 'done' };
            break;
        }
      }
    },
  };
}

@Injectable()
export class PiAgentService {
  private sessionManager: {
    save: (session: AgentSessionData) => Promise<void>;
    load: (sessionId: string) => Promise<AgentSessionData | null>;
    list: (userId: string, workspaceId: string) => Promise<AgentSessionData[]>;
    delete: (sessionId: string) => Promise<void>;
  } | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly chatExecutionService: ChatExecutionService,
  ) {}

  private async getSessionManager() {
    if (!this.sessionManager) {
      const { DatabaseSessionManager } = await import('@consuelo/agent');

      this.sessionManager = new DatabaseSessionManager({
        query: async (sql: string, params?: unknown[]) => {
          const rows = await this.dataSource.query(sql, params);

          return { rows: rows as Record<string, unknown>[] };
        },
      });
    }

    return this.sessionManager;
  }

  // stream a chat response as pi-format SSE — wraps twenty's ChatExecutionService
  // with our agent extensions and returns a ReadableStream of SSE bytes
  async streamChat(
    executionOptions: ChatExecutionOptions,
    conversationId?: string,
  ): Promise<ChatResult> {
    const { workspace, userWorkspaceId, messages } = executionOptions;

    const session = createPiSessionFromAiSdk(
      this.chatExecutionService,
      executionOptions,
    );

    const lastUserMsg = messages[messages.length - 1];
    const textPart = lastUserMsg?.parts?.find(
      (p: { type: string }) => p.type === 'text',
    ) as { type: 'text'; text: string } | undefined;
    const lastUserText = textPart?.text ?? '';

    const request: ChatRequest = {
      message: lastUserText,
      conversationId,
    };

    const config = {
      systemPrompt: BASE_SYSTEM_PROMPT,
      model: '',
      provider: '',
      maxTokens: 4096,
    };

    // stub context loader — twenty's ChatExecutionService handles context
    const contextLoader: ContextLoader = {
      load: async (userId: string, wsId: string): Promise<AgentContext> => ({
        userId,
        workspaceId: wsId,
        recentActivity: [],
        connectedIntegrations: [],
        memories: [],
      }),
    };

    const sessionManager = await this.getSessionManager();
    const { handleChat } = await import('@consuelo/agent');

    return handleChat(request, userWorkspaceId, workspace.id, {
      config,
      contextLoader,
      session,
      sessionManager,
    });
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
      usageStore?: UsageStore;
      phoneNumberRecommendationService?: PhoneNumberRecommendationService;
    },
  ): Promise<AgentSessionData> {
    try {
      const {
        createContextInjection,
        createPipelineIntelligence,
        createPreferenceInference,
        createTurnGrading,
        createUsageTracking,
        createPiCrmTools,
        createDialerTools,
        createKbTools,
        createPhoneNumberTools,
      } = await import('@consuelo/agent');

      const sessionManager = await this.getSessionManager();
      const extensions: Array<ContextInjection | PipelineIntelligence> = [];

      if (options?.contextLoader) {
        extensions.push(
          createContextInjection(options.contextLoader, userId, workspaceId),
        );
      }

      if (options?.crmClient) {
        extensions.push(createPipelineIntelligence(options.crmClient));
      }

      const afterTurnExtensions: AfterTurnExtension[] = [];

      if (options?.memoryStore) {
        afterTurnExtensions.push(
          createPreferenceInference(options.memoryStore),
        );
      }

      if (options?.executionStore) {
        afterTurnExtensions.push(createTurnGrading(options.executionStore));
      }

      if (options?.usageStore) {
        afterTurnExtensions.push(createUsageTracking(options.usageStore));
      }

      const tools: AgentTool[] = [
        ...(options?.crmClient ? createPiCrmTools(options.crmClient) : []),
        ...(options?.dialerService
          ? createDialerTools(options.dialerService, userId)
          : []),
        ...(options?.kbService ? createKbTools(options.kbService) : []),
        ...(options?.phoneNumberRecommendationService
          ? createPhoneNumberTools(options.phoneNumberRecommendationService)
          : []),
      ];

      const session: AgentSessionData = {
        id: randomUUID(),
        workspaceId,
        userId,
        messages: [],
        systemPrompt: BASE_SYSTEM_PROMPT,
        modelId: '',
        metadata: {
          toolNames: tools.map((t) => t.name),
          hasContextInjection: !!options?.contextLoader,
          hasPipelineIntelligence: !!options?.crmClient,
          hasPreferenceInference: !!options?.memoryStore,
          hasTurnGrading: !!options?.executionStore,
          hasUsageTracking: !!options?.usageStore,
          extensionCount: extensions.length,
          afterTurnExtensionCount: afterTurnExtensions.length,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await sessionManager.save(session);

      return session;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error creating session';

      throw new Error(`PiAgentService.createSession failed: ${message}`);
    }
  }

  async loadSession(
    sessionId: string,
    callerUserId: string,
    callerWorkspaceId: string,
  ): Promise<AgentSessionData | null> {
    try {
      const sessionManager = await this.getSessionManager();
      const session = await sessionManager.load(sessionId);

      if (!session) return null;

      if (
        session.userId !== callerUserId ||
        session.workspaceId !== callerWorkspaceId
      ) {
        return null;
      }

      return session;
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
      const sessionManager = await this.getSessionManager();

      return await sessionManager.list(userId, workspaceId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error listing sessions';

      throw new Error(`PiAgentService.listSessions failed: ${message}`);
    }
  }

  async deleteSession(
    sessionId: string,
    callerUserId: string,
    callerWorkspaceId: string,
  ): Promise<void> {
    try {
      const sessionManager = await this.getSessionManager();
      const session = await sessionManager.load(sessionId);

      if (!session) return;

      if (
        session.userId !== callerUserId ||
        session.workspaceId !== callerWorkspaceId
      ) {
        return;
      }

      await sessionManager.delete(sessionId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'unknown error deleting session';

      throw new Error(`PiAgentService.deleteSession failed: ${message}`);
    }
  }
}
