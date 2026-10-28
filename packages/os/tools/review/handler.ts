import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "aiReview",
    "command": {
      "script": "ai-review",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "pr",
          "kind": "value"
        },
        {
          "source": "noPost",
          "flag": "--no-post",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "prReview",
    "command": {
      "script": "pr-review",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "pr",
          "kind": "value"
        },
        {
          "source": "stdout",
          "flag": "--stdout",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "review.run",
    "command": {
      "script": "review",
      "branchMode": "required",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "fix",
          "flag": "--fix",
          "kind": "boolean"
        },
        {
          "source": "all",
          "flag": "--all",
          "kind": "boolean"
        },
        {
          "source": "base",
          "flag": "--base",
          "kind": "value"
        },
        {
          "source": "strict",
          "flag": "--strict",
          "kind": "boolean"
        },
        {
          "source": "mine",
          "flag": "--mine",
          "kind": "boolean"
        },
        {
          "source": "noTests",
          "flag": "--no-tests",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "verify",
    "command": {
      "script": "verify",
      "branchMode": "optional",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "base",
          "flag": "--base",
          "kind": "value"
        },
        {
          "source": "noStamp",
          "flag": "--no-stamp",
          "kind": "boolean"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
