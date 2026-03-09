// coaching lifecycle extension for pi-agent-core
// detects recently ended calls and injects post-call analysis context
// when no recently ended call, passes messages through unchanged

import type { AgentMessage } from '@mariozechner/pi-agent-core';

import type { SkillSuggestion } from '../types.js';

// marker prefix to identify injected post-call messages (for dedup across turns)
const POST_CALL_MARKER = '[POST_CALL_CONTEXT]';

const isPostCallMessage = (msg: AgentMessage): boolean =>
  'role' in msg &&
  msg.role === 'user' &&
  typeof msg.content === 'string' &&
  msg.content.startsWith(POST_CALL_MARKER);

// post-call analysis instructions — embedded so the library works without filesystem access
const POST_CALL_INSTRUCTIONS = `You just finished a call. Analyze it and take action.

1. Generate call analytics (sentiment, key moments, performance metrics)
2. Log the call outcome in CRM (use the log_call tool)
3. Update the deal if relevant (use the update_deal tool)
4. Create follow-up tasks if needed (use the create_task tool)
5. Create a call note with the summary (use the create_note tool)

Respond with JSON:
{
  "analytics": {
    "key_moments": [{ "timestamp": "string", "type": "objection|commitment|question|insight", "description": "string", "impact": "positive|negative|neutral" }],
    "sentiment": { "overall": "positive|negative|neutral|mixed", "customer": "string", "agent": "string", "trend": "improving|declining|stable" },
    "performance": { "talk_ratio": 0.0, "response_time_avg": 0.0, "objection_handling_score": 0.0 }
  },
  "actions_taken": ["list of CRM actions performed"]
}

Rules:
- Always log the call outcome
- Always create a note with key takeaways
- If the customer expressed interest, update the deal stage
- If a follow-up was promised, create a task with a due date`;

export type RecentlyEndedCall = {
  contactName: string;
  duration: number;
  outcome: string | undefined;
  hasTranscript: boolean;
  analyzed: boolean;
};

export type CoachingLifecycle = {
  transformContext: (
    messages: AgentMessage[],
    signal?: AbortSignal,
  ) => Promise<AgentMessage[]>;
  buildSystemPromptSuffix: () => string;
  getSuggestedSkills: () => SkillSuggestion[];
};

export const createCoachingLifecycle = (
  getRecentlyEndedCall: () => Promise<RecentlyEndedCall | null>,
): CoachingLifecycle => {
  let lastSuggestions: SkillSuggestion[] = [];

  return {
    transformContext: async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
      try {
        const recentCall = await getRecentlyEndedCall();

        // no recently ended unanalyzed call — pass through unchanged
        if (!recentCall || recentCall.analyzed) {
          lastSuggestions = [];
          return messages.filter((m) => !isPostCallMessage(m));
        }

        // suggest post-call analysis skill
        lastSuggestions = [{ skillId: 'post-call-analysis', reason: 'call recently ended' }];

        const block = [
          POST_CALL_MARKER,
          '<post_call_analysis>',
          POST_CALL_INSTRUCTIONS,
          '</post_call_analysis>',
          '<completed_call>',
          `Contact: ${recentCall.contactName}`,
          `Duration: ${recentCall.duration}s`,
          `Outcome: ${recentCall.outcome ?? 'unknown'}`,
          `Transcript available: ${recentCall.hasTranscript}`,
          '</completed_call>',
        ].join('\n');

        // remove old post-call messages, prepend fresh one
        const filtered = messages.filter((m) => !isPostCallMessage(m));

        const postCallMessage: AgentMessage = {
          role: 'user' as const,
          content: block,
          timestamp: Date.now(),
        };

        return [postCallMessage, ...filtered];
      } catch {
        // don't block the agent if lifecycle detection fails — strip stale prompts
        lastSuggestions = [];
        return messages.filter((m) => !isPostCallMessage(m));
      }
    },

    // static suffix is empty — all injection is dynamic via transformContext
    buildSystemPromptSuffix: () => '',

    getSuggestedSkills: () => lastSuggestions,
  };
};
