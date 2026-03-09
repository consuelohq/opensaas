// context injection extension for pi-agent-core
// loads CRM context, memories, methodology and injects as XML blocks before each LLM call
// reuses existing context engine logic — does NOT rewrite it

import type { AgentMessage } from '@mariozechner/pi-agent-core';

import type { ContextLoader, ContextLayer } from '../context/types.js';
import {
  buildContextLayers,
  renderContextBlock,
  estimateTokens,
} from '../context/context-engine.service.js';
import { buildCallContextBlock } from '../context/call-context.service.js';
import { DEFAULT_CONTEXT_BUDGET } from '../context/types.js';

// marker prefix to identify injected context messages (for dedup across turns)
const CONTEXT_MARKER = '[CONSUELO_CONTEXT]';

const isContextMessage = (msg: AgentMessage): boolean =>
  'role' in msg &&
  msg.role === 'user' &&
  typeof msg.content === 'string' &&
  msg.content.startsWith(CONTEXT_MARKER);

// render memories as a simple list
const renderMemories = (
  memories: Array<{ key: string; value: string; confidence: number }>,
): string => {
  if (memories.length === 0) return '';

  return memories
    .map((m) => `- ${m.key}: ${m.value} (confidence: ${m.confidence})`)
    .join('\n');
};

// build context layers from loaded agent context
const buildLayers = (context: {
  activeCall?: { callSid: string; contactId: string; contactName: string; direction: 'inbound' | 'outbound'; startedAt: Date; durationSeconds?: number; participants?: Array<{ callSid: string; label: string }>; dealContext?: { dealId: string; dealName: string; stage: string; value: number; lastActivityAt: Date; daysInStage: number }; recentNotes?: string[] };
  memories: Array<{ key: string; value: string; confidence: number }>;
  activeMethodology?: { systemPrompt: string };
  pipelineContext?: unknown;
}): ContextLayer[] => {
  const layers: ContextLayer[] = [];

  // CRM context (highest priority)
  if (context.activeCall) {
    const callBlock = buildCallContextBlock({
      callSid: context.activeCall.callSid,
      contactId: context.activeCall.contactId,
      contactName: context.activeCall.contactName,
      direction: context.activeCall.direction,
      startedAt: context.activeCall.startedAt,
      durationSeconds: context.activeCall.durationSeconds ?? 0,
      participants: (context.activeCall.participants ?? []) as Array<{ callSid: string; label: 'agent' | 'customer' | 'transfer-target'; phoneNumber?: string }>,
      recentNotes: context.activeCall.recentNotes ?? [],
      dealContext: context.activeCall.dealContext,
    });
    const content = callBlock;

    layers.push({
      name: 'crm_context',
      priority: 1,
      content,
      tokenEstimate: estimateTokens(content),
    });
  }

  // user memories
  if (context.memories.length > 0) {
    const content = renderMemories(context.memories);

    layers.push({
      name: 'user_context',
      priority: 3,
      content,
      tokenEstimate: estimateTokens(content),
    });
  }

  // sales methodology
  if (context.activeMethodology?.systemPrompt) {
    const content = context.activeMethodology.systemPrompt;

    layers.push({
      name: 'methodology',
      priority: 4,
      content,
      tokenEstimate: estimateTokens(content),
    });
  }

  return layers;
};

export type ContextInjection = {
  transformContext: (
    messages: AgentMessage[],
    signal?: AbortSignal,
  ) => Promise<AgentMessage[]>;
  buildSystemPromptSuffix: () => string;
};

export const createContextInjection = (
  contextLoader: ContextLoader,
  userId: string,
  workspaceId: string,
): ContextInjection => ({
  // dynamic per-turn context injection
  transformContext: async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
    try {
      const context = await contextLoader.load(userId, workspaceId);

      const layers = buildContextLayers(
        buildLayers(context),
        DEFAULT_CONTEXT_BUDGET,
      );

      if (layers.length === 0) return messages.filter((m) => !isContextMessage(m));

      const contextBlock = `${CONTEXT_MARKER}\n${renderContextBlock(layers)}`;

      // remove old context messages, prepend fresh one
      const filtered = messages.filter((m) => !isContextMessage(m));

      const contextMessage: AgentMessage = {
        role: 'user' as const,
        content: contextBlock,
        timestamp: Date.now(),
      };

      return [contextMessage, ...filtered];
    } catch {
      // don't block the agent if context loading fails — but strip stale context
      return messages.filter((m) => !isContextMessage(m));
    }
  },

  // static suffix is empty — all injection is dynamic via transformContext
  buildSystemPromptSuffix: () => '',
});
