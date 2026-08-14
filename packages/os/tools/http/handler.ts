import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "http",
    "command": {
      "script": "fs",
      "subcommand": "http",
      "branchMode": "none",
      "arguments": [
        {
          "source": "method",
          "kind": "value"
        },
        {
          "source": "url",
          "kind": "value",
          "required": true
        },
        {
          "source": "headers",
          "kind": "record"
        },
        {
          "source": "body",
          "kind": "value",
          "flag": "--raw"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
