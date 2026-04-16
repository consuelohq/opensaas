// skill executor — non-interactive skill invocation (no session, no tools, no streaming)
// uses the ai SDK provider passed by the caller (twenty-server owns provider config)

import { Logger } from '@consuelo/logger';

const logger = new Logger('agent:skill-executor');

export type SkillExecutorOptions = {
  generateText: (params: {
    model: unknown;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
  }) => Promise<{ text: string }>;
  model: unknown;
};

export type SkillInput = Record<string, unknown>;

export type SkillResult<TOutput = Record<string, unknown>> = {
  success: boolean;
  output?: TOutput;
  error?: string;
};

// strip markdown code fences from LLM response before parsing
const stripCodeFences = (text: string): string => {
  const stripped = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return stripped.trim();
};

export const executeSkill = async <TOutput = Record<string, unknown>>(
  skillPrompt: string,
  input: SkillInput,
  options: SkillExecutorOptions,
): Promise<SkillResult<TOutput>> => {
  const fullPrompt = `${skillPrompt}\n\n## Input\n\n${JSON.stringify(input, null, 2)}`;

  try {
    const { text } = await options.generateText({
      model: options.model,
      prompt: fullPrompt,
      temperature: 0.1,
      maxTokens: 1000,
    });

    const cleaned = stripCodeFences(text);
    const output = JSON.parse(cleaned) as TOutput;

    return { success: true, output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'skill execution failed';
    logger.error(`skill execution failed: ${message}`, { err });

    return { success: false, error: message };
  }
};
