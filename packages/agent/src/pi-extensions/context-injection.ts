// minimal context injection for pi-agent-core
// proves the pattern works — full implementation in Pi.5

import type { AgentMessage } from '@mariozechner/pi-agent-core';

const CRM_CONTEXT_PLACEHOLDER =
  '<crm_context>\nContext injection working. Full implementation in Pi.5.\n</crm_context>';

// transformContext callback for Agent — appends <crm_context> as a system-level user message
// pi's Agent uses transformContext to modify the message list before each LLM call
export const createContextInjection = (): {
  transformContext: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
  buildSystemPromptSuffix: () => string;
} => ({
  // injects context into the message stream (for dynamic per-turn context)
  transformContext: async (messages: AgentMessage[]) => messages,

  // appends to system prompt (for static context injection)
  buildSystemPromptSuffix: () => `\n\n${CRM_CONTEXT_PLACEHOLDER}`,
});
