import type { AgentToolDefinition, ToolRegistry } from './types.js';

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, AgentToolDefinition>();

  return {
    tools,
    register(tool: AgentToolDefinition) {
      tools.set(tool.name, tool);
    },
    get(name: string) {
      return tools.get(name);
    },
    toToolSet() {
      return Object.fromEntries(tools);
    },
  };
}
