import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "gh",
    "command": {
      "script": "gh",
      "branchMode": "none",
      "arguments": [
        {
          "source": "action",
          "kind": "value",
          "required": true
        },
        {
          "source": "args",
          "kind": "array"
        }
      ]
    }
  },
  {
    "name": "github",
    "command": {
      "script": "github",
      "branchMode": "none",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "operation",
          "kind": "value",
          "required": true
        },
        {
          "source": "repo",
          "flag": "--repo",
          "kind": "value"
        },
        {
          "source": "pr",
          "flag": "--pr",
          "kind": "value"
        },
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "base",
          "flag": "--base",
          "kind": "value"
        },
        {
          "source": "head",
          "flag": "--head",
          "kind": "value"
        },
        {
          "source": "preset",
          "flag": "--preset",
          "kind": "value"
        },
        {
          "source": "fields",
          "flag": "--field",
          "kind": "array"
        },
        {
          "source": "limit",
          "flag": "--limit",
          "kind": "value"
        },
        {
          "source": "state",
          "flag": "--state",
          "kind": "value"
        },
        {
          "source": "body",
          "flag": "--body",
          "kind": "value"
        },
        {
          "source": "bodyFile",
          "flag": "--body-file",
          "kind": "value"
        },
        {
          "source": "wait",
          "flag": "--wait",
          "kind": "boolean"
        },
        {
          "source": "squash",
          "flag": "--squash",
          "kind": "boolean"
        },
        {
          "source": "full",
          "flag": "--full",
          "kind": "boolean"
        },
        {
          "source": "mergeMethod",
          "flag": "--merge-method",
          "kind": "value"
        },
        {
          "source": "rawArgs",
          "flag": "--raw-arg",
          "kind": "array"
        },
        {
          "source": "args",
          "flag": "--raw-arg",
          "kind": "array"
        },
        {
          "source": "reason",
          "flag": "--reason",
          "kind": "value"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
