// coaching detector extension for pi-agent-core
// detects active calls and injects coaching skill instructions + call context
// when no active call, passes messages through unchanged (normal assistant mode)

import type { AgentMessage } from '@mariozechner/pi-agent-core';

import type { ActiveCallState } from '../types.js';
import { buildCallContextBlock } from '../context/call-context.service.js';
import type { CallParticipant } from '../context/call-context.types.js';

// marker prefix to identify injected coaching messages (for dedup across turns)
const COACHING_MARKER = '[COACHING_CONTEXT]';

const isCoachingMessage = (msg: AgentMessage): boolean =>
  'role' in msg &&
  msg.role === 'user' &&
  typeof msg.content === 'string' &&
  msg.content.startsWith(COACHING_MARKER);

// coaching skill instructions — embedded so the library works without filesystem access
const COACHING_INSTRUCTIONS = `You are providing real-time sales coaching during an active call.

Analyze the conversation and provide actionable coaching. Focus on what the rep should say or ask RIGHT NOW.

Respond with JSON:
{
  "product_or_option_name": "string — the product, feature, or topic to focus on",
  "details": ["1-3 bold actionable phrases the rep should say next"],
  "clarifying_questions": ["2-3 pain funnel questions to ask the prospect"]
}

Rules:
- Be direct and actionable — no summaries, no fluff
- Focus on the customer's last statement
- Suggest specific phrases to say, not general advice
- If the customer raised an objection, address it first
- Keep suggestions under 50 words total`;

// convert ActiveCallState to the shape buildCallContextBlock expects
const toExpandedContext = (call: ActiveCallState) => ({
  callSid: call.callSid,
  contactId: call.contactId,
  contactName: call.contactName,
  direction: call.direction,
  startedAt: call.startedAt,
  durationSeconds: call.durationSeconds ?? 0,
  participants: (call.participants ?? []) as CallParticipant[],
  dealContext: call.dealContext,
  recentNotes: call.recentNotes ?? [],
});

export type CoachingDetector = {
  transformContext: (
    messages: AgentMessage[],
    signal?: AbortSignal,
  ) => Promise<AgentMessage[]>;
  buildSystemPromptSuffix: () => string;
};

export const createCoachingDetector = (
  getActiveCall: () => ActiveCallState | undefined,
): CoachingDetector => ({
  transformContext: async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
    try {
      const activeCall = getActiveCall();

      // no active call — pass through unchanged (normal assistant mode)
      if (!activeCall) {
        return messages.filter((m) => !isCoachingMessage(m));
      }

      // build call context block using existing renderer
      const callContext = buildCallContextBlock(toExpandedContext(activeCall));

      const block = [
        COACHING_MARKER,
        '<coaching_skill>',
        COACHING_INSTRUCTIONS,
        '</coaching_skill>',
        '<active_call>',
        callContext,
        '</active_call>',
      ].join('\n');

      // remove old coaching messages, prepend fresh one
      const filtered = messages.filter((m) => !isCoachingMessage(m));

      const coachingMessage: AgentMessage = {
        role: 'user' as const,
        content: block,
        timestamp: Date.now(),
      };

      return [coachingMessage, ...filtered];
    } catch {
      // don't block the agent if coaching detection fails — strip stale context
      return messages.filter((m) => !isCoachingMessage(m));
    }
  },

  // static suffix is empty — all injection is dynamic via transformContext
  buildSystemPromptSuffix: () => '',
});
