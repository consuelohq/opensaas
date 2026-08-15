import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "audit",
    "command": {
      "script": "audit",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "scripts",
          "flag": "--scripts",
          "kind": "boolean"
        },
        {
          "source": "docs",
          "flag": "--docs",
          "kind": "boolean"
        },
        {
          "source": "index",
          "flag": "--index",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "confidenceScore",
    "command": {
      "script": "confidence-score",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "confirm",
    "command": {
      "script": "confirm",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "verify",
          "flag": "--verify",
          "kind": "boolean"
        },
        {
          "source": "test",
          "flag": "--test",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "decideNext",
    "command": {
      "script": "decide-next",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "context",
          "flag": "--context",
          "kind": "value"
        },
        {
          "source": "markRead",
          "flag": "--mark-read",
          "kind": "value"
        },
        {
          "source": "markRelevant",
          "flag": "--mark-relevant",
          "kind": "value"
        },
        {
          "source": "markIrrelevant",
          "flag": "--mark-irrelevant",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "exploit",
    "command": {
      "script": "exploit",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "query",
          "kind": "value"
        },
        {
          "source": "target",
          "flag": "--target",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "explore",
    "command": {
      "script": "explore",
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
          "flag": "--budget",
          "kind": "value"
        },
        {
          "source": "changedOnly",
          "flag": "--changed-only",
          "kind": "boolean"
        },
        {
          "source": "detail",
          "flag": "--detail",
          "kind": "value"
        },
        {
          "source": "reindex",
          "flag": "--reindex",
          "kind": "boolean"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
