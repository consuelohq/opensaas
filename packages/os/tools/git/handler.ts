import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "git.diff",
    "command": {
      "script": "git:diff",
      "branchMode": "required",
      "branchArgumentStyle": "flag",
      "jsonFlag": "--json",
      "arguments": [
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
          "source": "paths",
          "flag": "--paths",
          "kind": "array"
        },
        {
          "source": "stat",
          "flag": "--stat",
          "kind": "boolean"
        },
        {
          "source": "files",
          "flag": "--files",
          "kind": "boolean"
        },
        {
          "source": "hunks",
          "flag": "--hunks",
          "kind": "boolean"
        },
        {
          "source": "patch",
          "flag": "--patch",
          "kind": "boolean"
        },
        {
          "source": "nameOnly",
          "flag": "--name-only",
          "kind": "boolean"
        },
        {
          "source": "context",
          "flag": "--context",
          "kind": "value"
        },
        {
          "source": "maxBytes",
          "flag": "--max-bytes",
          "kind": "value"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
