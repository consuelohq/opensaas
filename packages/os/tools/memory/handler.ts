import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "memory",
    "command": {
      "script": "memory",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "operation",
          "kind": "value",
          "required": true
        },
        {
          "source": "index",
          "kind": "value"
        },
        {
          "source": "keyword",
          "kind": "value"
        },
        {
          "source": "title",
          "kind": "value"
        },
        {
          "source": "file",
          "kind": "value"
        },
        {
          "source": "category",
          "flag": "--category",
          "kind": "value"
        },
        {
          "source": "limit",
          "flag": "--limit",
          "kind": "value"
        },
        {
          "source": "byTitle",
          "flag": "--by-title",
          "kind": "boolean"
        },
        {
          "source": "text",
          "flag": "--text",
          "kind": "boolean"
        },
        {
          "source": "traceId",
          "flag": "--trace-id",
          "kind": "value"
        },
        {
          "source": "tool",
          "flag": "--tool",
          "kind": "value"
        },
        {
          "source": "status",
          "flag": "--status",
          "kind": "value"
        },
        {
          "source": "since",
          "flag": "--since",
          "kind": "value"
        },
        {
          "source": "until",
          "flag": "--until",
          "kind": "value"
        },
        {
          "source": "contains",
          "flag": "--contains",
          "kind": "value"
        },
        {
          "source": "memoryTaskSession",
          "flag": "--task-session",
          "kind": "value"
        },
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "raw",
          "flag": "--raw",
          "kind": "boolean"
        },
        {
          "source": "db",
          "flag": "--db",
          "kind": "value"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
