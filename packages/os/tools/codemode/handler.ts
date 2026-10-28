import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "code.call",
    "command": {
      "script": "code-call",
      "branchMode": "none",
      "jsonFlag": "--json",
      "internal": "code.call",
      "arguments": []
    }
  },
  {
    "name": "code.run",
    "command": {
      "script": "code-run",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "taskSession",
          "kind": "value"
        },
        {
          "source": "code",
          "kind": "value",
          "required": true
        },
        {
          "source": "mode",
          "flag": "--mode",
          "kind": "value"
        },
        {
          "source": "timeout",
          "flag": "--timeout",
          "kind": "value"
        },
        {
          "source": "memoryLimit",
          "flag": "--memory-limit",
          "kind": "value"
        },
        {
          "source": "maxOperations",
          "flag": "--max-operations",
          "kind": "value"
        },
        {
          "source": "maxResultChars",
          "flag": "--max-result-chars",
          "kind": "value"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
