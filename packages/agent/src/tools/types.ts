import type { z, ZodTypeAny } from 'zod';

export type AgentToolDefinition<TParams extends ZodTypeAny = ZodTypeAny> = {
  name: string;
  description: string;
  parameters: TParams;
  execute: (args: z.infer<TParams>) => Promise<unknown>;
};

export type ToolRegistry = {
  tools: Map<string, AgentToolDefinition>;
  register: (tool: AgentToolDefinition) => void;
  get: (name: string) => AgentToolDefinition | undefined;
  toToolSet: () => Record<string, AgentToolDefinition>;
};
