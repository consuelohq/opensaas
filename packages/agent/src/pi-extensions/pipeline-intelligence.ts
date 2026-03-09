// pipeline intelligence extension for pi-agent-core
// scores deals and injects <pipeline_context> before each LLM call
// reuses existing pipeline intelligence logic — does NOT rewrite it

import type { AgentMessage } from '@mariozechner/pi-agent-core';

import type { CrmClient } from '../crm/client.js';
import type { DealInput, StageAverage } from '../context/pipeline.types.js';
import { buildPipelineContext } from '../context/pipeline-intelligence.service.js';
import { estimateTokens } from '../context/context-engine.service.js';

// marker prefix to identify injected pipeline messages (for dedup across turns)
const PIPELINE_MARKER = '[PIPELINE_CONTEXT]';

const isPipelineMessage = (msg: AgentMessage): boolean =>
  'role' in msg &&
  msg.role === 'user' &&
  typeof msg.content === 'string' &&
  msg.content.startsWith(PIPELINE_MARKER);

// default stage averages — will be replaced with real data when available
const DEFAULT_STAGE_AVERAGES: StageAverage[] = [
  { stage: 'QUALIFICATION', averageDays: 14, probability: 0.2 },
  { stage: 'DISCOVERY', averageDays: 21, probability: 0.35 },
  { stage: 'PROPOSAL', averageDays: 14, probability: 0.5 },
  { stage: 'NEGOTIATION', averageDays: 10, probability: 0.75 },
  { stage: 'CLOSED_WON', averageDays: 0, probability: 1.0 },
  { stage: 'CLOSED_LOST', averageDays: 0, probability: 0.0 },
];

// max tokens for pipeline context block
const PIPELINE_TOKEN_BUDGET = 800;

// convert CRM DealResult to DealInput for scoring (safe defaults for missing fields)
const toDealInput = (deal: {
  id: string;
  name: string;
  stage: string;
  amount?: number;
}): DealInput => ({
  id: deal.id,
  name: deal.name,
  stage: deal.stage,
  value: deal.amount ?? 0,
  closeDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  daysInCurrentStage: 0,
  daysSinceLastInteraction: 0,
  hasChampion: false,
  hasFriendlyContact: false,
  hasCompetitor: false,
  hasActiveCompetitor: false,
});

// render pipeline context as human-readable text
const renderPipelineBlock = (ctx: ReturnType<typeof buildPipelineContext>): string => {
  const parts: string[] = [];

  const { health } = ctx;

  parts.push(
    `Pipeline health: ${health.label} (score: ${health.score}/100, ${health.totalDeals} deals, forecast: $${health.forecastedRevenue.toLocaleString()})`,
  );

  if (health.insights.length > 0) {
    parts.push('Insights:');
    for (const insight of health.insights) {
      parts.push(`- ${insight}`);
    }
  }

  if (ctx.topRisks.length > 0) {
    parts.push('Top at-risk deals:');
    for (const deal of ctx.topRisks) {
      const topFactor = deal.factors.reduce((max, f) =>
        f.score * f.weight > max.score * max.weight ? f : max,
      );

      parts.push(
        `- ${deal.dealName} (${deal.stage}): risk ${deal.riskScore}/100, $${deal.value.toLocaleString()} — top factor: ${topFactor.label}`,
      );
    }
  }

  return parts.join('\n');
};

export type PipelineIntelligence = {
  transformContext: (
    messages: AgentMessage[],
    signal?: AbortSignal,
  ) => Promise<AgentMessage[]>;
  buildSystemPromptSuffix: () => string;
};

export const createPipelineIntelligence = (
  crmClient: CrmClient,
  stageAverages: StageAverage[] = DEFAULT_STAGE_AVERAGES,
): PipelineIntelligence => ({
  transformContext: async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
    try {
      const deals = await crmClient.listDeals();

      // skip if no open deals
      const openDeals = deals.filter(
        (d) => d.stage !== 'CLOSED_WON' && d.stage !== 'CLOSED_LOST',
      );

      if (openDeals.length === 0) return messages;

      const pipelineCtx = buildPipelineContext(
        openDeals.map(toDealInput),
        stageAverages,
        [],
      );

      const rendered = renderPipelineBlock(pipelineCtx);

      // respect token budget — truncate if too large
      const tokens = estimateTokens(rendered);
      const content = tokens > PIPELINE_TOKEN_BUDGET
        ? rendered.slice(0, PIPELINE_TOKEN_BUDGET * 4)
        : rendered;

      const block = `${PIPELINE_MARKER}\n<pipeline_context>\n${content}\n</pipeline_context>`;

      // remove old pipeline messages, prepend fresh one
      const filtered = messages.filter((m) => !isPipelineMessage(m));

      const pipelineMessage: AgentMessage = {
        role: 'user' as const,
        content: block,
        timestamp: Date.now(),
      };

      return [pipelineMessage, ...filtered];
    } catch {
      // don't block the agent if pipeline loading fails
      return messages;
    }
  },

  buildSystemPromptSuffix: () => '',
});
