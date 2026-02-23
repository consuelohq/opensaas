import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { AgentConversationSummaryEntity } from 'src/engine/core-modules/agent/entities/agent-conversation-summary.entity';
import { AgentMemoryService } from 'src/engine/core-modules/agent/services/memory.service';
import { CallContextService } from 'src/engine/core-modules/agent/services/call-context.service';
import { PipelineIntelligenceService } from 'src/engine/core-modules/agent/services/pipeline-intelligence.service';
import { PreferenceInferenceService } from 'src/engine/core-modules/agent/services/preference-inference.service';

type ContextLayer = {
  name: string;
  priority: number;
  content: string;
  tokenEstimate: number;
};

type SkillOutput = {
  skillId: string;
  skillName: string;
  output: unknown;
  executedAt: Date;
  conversationId?: string;
};

type BuildContextOptions = {
  activeCallSid?: string;
  currentMessage?: string;
  skillId?: string;
};

const SKILL_OUTPUT_TTL_MS = 3_600_000; // 1 hour

// rough token estimate: ~4 chars per token
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const MAX_CONTEXT_TOKENS = 4000;

@Injectable()
export class AgentContextEngineService {
  private readonly logger = new Logger(AgentContextEngineService.name);

  constructor(
    private readonly memoryService: AgentMemoryService,
    private readonly callContextService: CallContextService,
    private readonly pipelineService: PipelineIntelligenceService,
    private readonly preferenceService: PreferenceInferenceService,
    @InjectRepository(AgentConversationSummaryEntity, 'core')
    private readonly summaryRepository: Repository<AgentConversationSummaryEntity>,
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  async buildAgentContext(
    userId: string,
    workspaceId: string,
    options?: BuildContextOptions,
  ): Promise<ContextLayer[]> {
    try {
      // load all context layers in parallel — each wrapped in try/catch for graceful degradation
      const [memories, callContext, pipeline, skillOutputs] = await Promise.all(
        [
          this.loadMemories(userId),
          this.loadCallContext(workspaceId, options?.activeCallSid),
          this.loadPipeline(userId, workspaceId),
          this.loadSkillOutputs(userId, workspaceId, options?.skillId),
        ],
      );

      const layers: ContextLayer[] = [
        memories,
        callContext,
        pipeline,
        skillOutputs,
      ].filter((layer): layer is ContextLayer => layer !== null);

      // sort by priority (lower = higher), trim to fit budget
      const sorted = [...layers].sort((a, b) => a.priority - b.priority);
      const result: ContextLayer[] = [];
      let remaining = MAX_CONTEXT_TOKENS;

      for (const layer of sorted) {
        if (remaining <= 0) break;

        if (layer.tokenEstimate <= remaining) {
          result.push(layer);
          remaining -= layer.tokenEstimate;
        } else {
          const charLimit = remaining * 4;
          const trimmed = layer.content.slice(0, charLimit);

          result.push({
            ...layer,
            content: trimmed,
            tokenEstimate: estimateTokens(trimmed),
          });
          remaining = 0;
        }
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(
        `context assembly failed for user ${userId}: ${message}`,
      );

      return [];
    }
  }

  async cacheSkillOutput(
    key: string,
    output: SkillOutput,
    ttlMs = SKILL_OUTPUT_TTL_MS,
  ): Promise<void> {
    try {
      await this.cacheStorage.set(key, output, ttlMs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`cache skill output failed: ${message}`);
    }
  }

  async getSkillOutput(key: string): Promise<SkillOutput | null> {
    try {
      return (await this.cacheStorage.get<SkillOutput>(key)) ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`get skill output failed: ${message}`);

      return null;
    }
  }

  async saveSummary(
    conversationId: string,
    userId: string,
    workspaceId: string,
    summary: string,
    messageCount: number,
  ): Promise<void> {
    try {
      const entity = this.summaryRepository.create({
        conversationId,
        userId,
        workspaceId,
        summary,
        messageCount,
      });

      await this.summaryRepository.save(entity);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(
        `save summary failed for conversation ${conversationId}: ${message}`,
      );
    }
  }

  // --- private layer loaders ---

  private async loadMemories(userId: string): Promise<ContextLayer | null> {
    try {
      const memories = await this.memoryService.getTopMemories(userId, 10);

      if (memories.length === 0) return null;

      const content = memories
        .map((m) => `- ${m.key}: ${m.value} (confidence: ${m.confidence})`)
        .join('\n');

      return {
        name: 'memories',
        priority: 1,
        content,
        tokenEstimate: estimateTokens(content),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`load memories failed: ${message}`);

      return null;
    }
  }

  private async loadCallContext(
    workspaceId: string,
    callSid?: string,
  ): Promise<ContextLayer | null> {
    if (!callSid) return null;

    try {
      const ctx = await this.callContextService.getCallContext(
        workspaceId,
        callSid,
        '',
      );

      const parts: string[] = [];

      if (ctx.contact) {
        parts.push(`Contact: ${ctx.contact.name}`);
        if (ctx.contact.company) parts.push(`Company: ${ctx.contact.company}`);
      }

      if (ctx.deal) {
        parts.push(
          `Deal: ${ctx.deal.dealName} (${ctx.deal.stage}, $${ctx.deal.value})`,
        );
      }

      if (ctx.recentNotes.length > 0) {
        parts.push(`Notes: ${ctx.recentNotes.join('; ')}`);
      }

      if (parts.length === 0) return null;

      const content = parts.join('\n');

      return {
        name: 'call_context',
        priority: 2,
        content,
        tokenEstimate: estimateTokens(content),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`load call context failed: ${message}`);

      return null;
    }
  }

  private async loadPipeline(
    userId: string,
    workspaceId: string,
  ): Promise<ContextLayer | null> {
    try {
      const pipeline = await this.pipelineService.getPipelineContext(
        userId,
        workspaceId,
      );

      if (!pipeline) return null;

      const parts = [
        `Pipeline: ${pipeline.health.label} (score: ${pipeline.health.score}, ${pipeline.health.totalDeals} deals)`,
        `Forecast: $${pipeline.health.forecastedRevenue}`,
      ];

      if (pipeline.topRisks.length > 0) {
        const risks = pipeline.topRisks
          .slice(0, 3)
          .map((r) => `${r.dealName} (risk: ${r.riskScore})`)
          .join(', ');

        parts.push(`Top risks: ${risks}`);
      }

      const content = parts.join('\n');

      return {
        name: 'pipeline',
        priority: 3,
        content,
        tokenEstimate: estimateTokens(content),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`load pipeline failed: ${message}`);

      return null;
    }
  }

  private async loadSkillOutputs(
    userId: string,
    workspaceId: string,
    currentSkillId?: string,
  ): Promise<ContextLayer | null> {
    try {
      // load recent skill outputs from cache
      const cacheKey = `skill:outputs:${userId}:${workspaceId}:recent`;
      const recentKeys =
        (await this.cacheStorage.get<string[]>(cacheKey)) ?? [];

      if (recentKeys.length === 0) return null;

      const outputs: SkillOutput[] = [];

      for (const key of recentKeys) {
        const output = await this.cacheStorage.get<SkillOutput>(key);

        if (output && output.skillId !== currentSkillId) {
          outputs.push(output);
        }
      }

      if (outputs.length === 0) return null;

      const content = outputs
        .map(
          (o) =>
            `[${o.skillName}]: ${typeof o.output === 'string' ? o.output : JSON.stringify(o.output)}`,
        )
        .join('\n');

      return {
        name: 'skill_context',
        priority: 4,
        content,
        tokenEstimate: estimateTokens(content),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`load skill outputs failed: ${message}`);

      return null;
    }
  }
}
