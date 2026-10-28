import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "subagent",
    "command": {
      "script": "internal",
      "internal": "subagent",
      "arguments": []
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
