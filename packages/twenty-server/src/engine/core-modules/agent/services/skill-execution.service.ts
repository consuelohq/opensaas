import { Injectable, Logger } from '@nestjs/common';

import { streamText, type ToolSet } from 'ai';

import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

import {
  SkillExecutionException,
  SkillExecutionExceptionCode,
} from 'src/engine/core-modules/agent/skill-execution.exception';
import { validateIntegrationRequirements } from 'src/engine/core-modules/agent/services/integration-validator';
import {
  type Skill,
  type SkillExecutionContext,
  type SkillExecutionResult,
  type SkillOutput,
  type ToolCallRecord,
} from 'src/engine/core-modules/agent/types';

const DEFAULT_SANDBOX_TIMEOUT_MS = 30_000;

const SKILL_BASE_PROMPT = `You are a specialized skill executor. Follow the skill instructions precisely. Use only the tools provided. Return output in the requested format.`;

@Injectable()
export class SkillExecutionService {
  private readonly logger = new Logger(SkillExecutionService.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly aiModelRegistryService: AiModelRegistryService,
  ) {}

  async execute(
    skill: Skill,
    context: SkillExecutionContext,
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    this.validatePermission(skill, context);
    this.validateInput(skill, context);

    // integration gate — block on missing required, collect notes for missing optional
    const integrationResult = validateIntegrationRequirements(
      skill,
      context.connectedIntegrations ?? [],
    );

    if (!integrationResult.valid) {
      const first = integrationResult.missingRequired[0];

      throw new SkillExecutionException(
        `Connect ${first.integrationId} to use this skill: ${first.reason}`,
        SkillExecutionExceptionCode.INTEGRATION_MISSING,
      );
    }

    const notes: string[] = integrationResult.missingOptional.map(
      (i) =>
        `Note: Connect ${i.integrationId} for enhanced results (${i.reason})`,
    );

    // scope tools to only those declared in skill.tools[]
    const tools = await this.buildScopedTools(skill, context);

    // merge prompt: base + skill.systemPrompt
    const systemPrompt = `${SKILL_BASE_PROMPT}\n\n${skill.systemPrompt}`;

    const registeredModel =
      this.aiModelRegistryService.getDefaultPerformanceModel();

    if (!registeredModel) {
      throw new SkillExecutionException(
        'No AI model available',
        SkillExecutionExceptionCode.PROVIDER_ERROR,
      );
    }

    const toolCalls: ToolCallRecord[] = [];

    try {
      const result = await streamText({
        model: registeredModel.model,
        system: systemPrompt,
        tools,
        prompt: JSON.stringify(context.input),
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      });

      // consume stream to get final result
      const text = await result.text;
      const usage = await result.usage;

      const output = this.parseOutput(skill.outputFormat, text);

      return {
        skillId: skill.id,
        output,
        tokensUsed: {
          input: usage.inputTokens ?? 0,
          cached: 0,
          output: usage.outputTokens ?? 0,
          provider: registeredModel.modelId,
        },
        sandboxUsed: false,
        durationMs: Date.now() - startTime,
        toolCalls,
        ...(notes.length > 0 ? { notes } : {}),
      };
    } catch (error: unknown) {
      if (error instanceof SkillExecutionException) {
        throw error;
      }
      throw new SkillExecutionException(
        error instanceof Error ? error.message : 'Skill execution failed',
        SkillExecutionExceptionCode.PROVIDER_ERROR,
      );
    }
  }

  private validatePermission(
    skill: Skill,
    context: SkillExecutionContext,
  ): void {
    if (
      skill.isPublic ||
      skill.createdBy === context.userId ||
      skill.createdBy === 'system'
    ) {
      return;
    }
    throw new SkillExecutionException(
      `User ${context.userId} cannot execute skill ${skill.id}`,
      SkillExecutionExceptionCode.PERMISSION_DENIED,
    );
  }

  private validateInput(
    skill: Skill,
    context: SkillExecutionContext,
  ): void {
    if (!skill.inputSchema) {
      return;
    }
    // DEV-948 will add JSON schema validation here
    // for now, just check required top-level keys exist
    const schemaKeys = Object.keys(skill.inputSchema);
    const inputKeys = Object.keys(context.input);
    const missing = schemaKeys.filter((key) => !inputKeys.includes(key));

    if (missing.length > 0) {
      throw new SkillExecutionException(
        `Missing required input fields: ${missing.join(', ')}`,
        SkillExecutionExceptionCode.INPUT_VALIDATION_FAILED,
      );
    }
  }

  private async buildScopedTools(
    skill: Skill,
    context: SkillExecutionContext,
  ): Promise<ToolSet> {
    if (skill.tools.length === 0) {
      return {};
    }

    return this.toolRegistry.getToolsByName(skill.tools, {
      workspaceId: context.workspaceId,
      roleId: context.userId,
    });
  }

  private parseOutput(
    format: Skill['outputFormat'],
    text: string,
  ): SkillOutput {
    if (format === 'text') {
      return { format: 'text', content: text };
    }

    // structured formats: attempt JSON parse from LLM response
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;

      switch (format) {
        case 'table':
          return {
            format: 'table',
            columns: parsed.columns as string[],
            rows: parsed.rows as Record<string, unknown>[],
          };
        case 'report':
          return {
            format: 'report',
            sections: parsed.sections as SkillOutput extends {
              format: 'report';
              sections: infer S;
            }
              ? S
              : never,
          };
        case 'action':
          return {
            format: 'action',
            actions: parsed.actions as SkillOutput extends {
              format: 'action';
              actions: infer A;
            }
              ? A
              : never,
          };
        case 'chart':
          return {
            format: 'chart',
            imageUrl: parsed.imageUrl as string,
            altText: parsed.altText as string,
          };
        case 'mixed':
          return {
            format: 'mixed',
            parts: parsed.parts as SkillOutput[],
          };
        default:
          return { format: 'text', content: text };
      }
    } catch {
      // if JSON parse fails, fall back to text
      return { format: 'text', content: text };
    }
  }
}
