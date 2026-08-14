import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "tools.search",
    "command": {
      "script": "tools:search",
      "executionScope": "runtime",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "query",
          "kind": "value",
          "required": true
        },
        {
          "source": "limit",
          "flag": "--limit",
          "kind": "value"
        },
        {
          "source": "category",
          "flag": "--category",
          "kind": "value"
        },
        {
          "source": "readOnly",
          "flag": "--read-only",
          "kind": "boolean"
        },
        {
          "source": "mutating",
          "flag": "--mutating",
          "kind": "boolean"
        },
        {
          "source": "detail",
          "flag": "--detail",
          "kind": "value"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
