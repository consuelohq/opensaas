// turn grading extension for pi-agent-core
// evaluates each agent turn with a heuristic score 0-100
// inspired by Twenty's agent-turn-grader.service.ts fallback evaluation

import type { CreateExecutionInput, ExecutionStore } from '../types.js';
import type { AfterTurnExtension, AfterTurnEvent } from './after-turn.types.js';

export type TurnEvaluation = {
  score: number;
  comment: string;
};

// heuristic evaluation — no LLM call, runs synchronously
const evaluateTurn = (event: AfterTurnEvent): TurnEvaluation => {
  const { assistantMessage, toolCalls } = event;
  const errors = toolCalls.filter((t) => t.error);

  let score = 100;
  const comments: string[] = [];

  // penalize errors
  if (errors.length > 0) {
    score -= errors.length * 30;
    comments.push(`${errors.length} tool error(s)`);
  }

  // penalize empty response
  if (!assistantMessage || assistantMessage.trim().length === 0) {
    score -= 50;
    comments.push('no response');
  }

  // credit tool usage (agent took action)
  if (toolCalls.length > 0 && errors.length === 0) {
    comments.push(`${toolCalls.length} tool(s) used successfully`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    comment: comments.length > 0 ? comments.join('; ') : 'completed',
  };
};

export const createTurnGrading = (
  executionStore: ExecutionStore,
): AfterTurnExtension => ({
  name: 'turn-grading',

  afterTurn: async (event: AfterTurnEvent): Promise<void> => {
    try {
      const evaluation = evaluateTurn(event);

      const input: CreateExecutionInput = {
        conversationId: event.metadata.conversationId,
        type: 'llm_response',
        status: evaluation.score >= 70 ? 'completed' : 'failed',
        output: { score: evaluation.score, comment: evaluation.comment },
      };

      await executionStore.create(input);
    } catch {
      // fire-and-forget — don't block the response on grading failures
    }
  },
});
