import type { AgentToolDefinition, ToolRegistry } from './types.js';

export const createToolRegistry = (): ToolRegistry => {
  const tools = new Map<string, AgentToolDefinition>();

  return {
    tools,
    register: (tool: AgentToolDefinition) => {
      tools.set(tool.name, tool);
    },
    get: (name: string) => tools.get(name),
    toToolSet: () => Object.fromEntries(tools),
  };
};
