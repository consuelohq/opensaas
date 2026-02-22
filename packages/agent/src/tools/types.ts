import type { z, ZodTypeAny } from 'zod';

export type AgentToolDefinition<TParams extends ZodTypeAny = ZodTypeAny> = {
  name: string;
  description: string;
  parameters: TParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any) => Promise<unknown>; // HACK: erased to unknown in Map<string, AgentToolDefinition>
};

export type ToolRegistry = {
  tools: ReadonlyMap<string, AgentToolDefinition>;
  register: (tool: AgentToolDefinition) => void;
  get: (name: string) => AgentToolDefinition | undefined;
  toToolSet: () => Record<string, AgentToolDefinition>;
};
