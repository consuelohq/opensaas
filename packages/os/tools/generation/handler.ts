import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "generate.docs",
    "command": {
      "script": "generate-docs",
      "branchMode": "none",
      "arguments": []
    }
  },
  {
    "name": "generate.types",
    "command": {
      "script": "generate-types",
      "branchMode": "none",
      "arguments": []
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
