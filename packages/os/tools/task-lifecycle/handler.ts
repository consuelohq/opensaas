import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "task.cleanup",
    "command": {
      "script": "task:cleanup",
      "branchMode": "none",
      "arguments": [
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "force",
          "flag": "--force",
          "kind": "boolean"
        },
        {
          "source": "preview",
          "flag": "--preview",
          "kind": "boolean"
        },
        {
          "source": "merged",
          "flag": "--merged",
          "kind": "boolean"
        },
        {
          "source": "staleDays",
          "flag": "--stale-days",
          "kind": "value"
        },
        {
          "source": "keep",
          "flag": "--keep",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "task.current",
    "command": {
      "script": "internal",
      "internal": "task.current",
      "arguments": []
    }
  },
  {
    "name": "task.ensureSynced",
    "command": {
      "script": "internal",
      "internal": "task.ensureSynced",
      "arguments": []
    }
  },
  {
    "name": "task.finish",
    "command": {
      "script": "task:finish",
      "branchMode": "required",
      "branchArgumentStyle": "flag",
      "arguments": [
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "pr",
          "flag": "--pr",
          "kind": "value"
        },
        {
          "source": "github",
          "flag": "--github",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "task.init",
    "command": {
      "script": "task:init",
      "branchMode": "none",
      "arguments": [
        {
          "source": "area",
          "flag": "--area",
          "kind": "value",
          "required": true
        },
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value",
          "required": true
        },
        {
          "source": "pr",
          "flag": "--pr",
          "kind": "value"
        },
        {
          "source": "worktree",
          "flag": "--worktree",
          "kind": "value"
        },
        {
          "source": "github",
          "flag": "--github",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "task.merge",
    "command": {
      "script": "task:merge",
      "branchMode": "none",
      "arguments": [
        {
          "source": "pr",
          "flag": "--pr",
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
          "source": "github",
          "flag": "--github",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "task.pr",
    "command": {
      "script": "task:pr",
      "branchMode": "required",
      "branchArgumentStyle": "flag",
      "arguments": [
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "repo",
          "flag": "--repo",
          "kind": "value"
        },
        {
          "source": "taskOnly",
          "flag": "--task-only",
          "kind": "boolean"
        },
        {
          "source": "draft",
          "flag": "--draft",
          "kind": "boolean"
        },
        {
          "source": "ready",
          "flag": "--ready",
          "kind": "boolean"
        },
        {
          "source": "bodyTemplate",
          "flag": "--body-template",
          "kind": "value"
        },
        {
          "source": "ackWorkpadIncomplete",
          "flag": "--ack-workpad-incomplete",
          "kind": "boolean"
        },
        {
          "source": "pr",
          "flag": "--pr",
          "kind": "value"
        },
        {
          "source": "github",
          "flag": "--github",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "task.prs",
    "command": {
      "script": "task:prs",
      "branchMode": "required",
      "branchArgumentStyle": "flag",
      "arguments": [
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "pr",
          "flag": "--pr",
          "kind": "value"
        },
        {
          "source": "github",
          "flag": "--github",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "task.push",
    "command": {
      "script": "task:push",
      "branchMode": "required",
      "branchArgumentStyle": "flag",
      "arguments": [
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "repo",
          "flag": "--repo",
          "kind": "value"
        },
        {
          "source": "taskSession",
          "flag": "--task-session",
          "kind": "value"
        },
        {
          "source": "message",
          "flag": "--message",
          "kind": "value",
          "required": true
        },
        {
          "source": "changed",
          "flag": "--changed",
          "kind": "boolean"
        },
        {
          "source": "files",
          "flag": "--files",
          "kind": "array"
        },
        {
          "source": "approved",
          "flag": "--approved",
          "kind": "boolean"
        },
        {
          "source": "reason",
          "flag": "--reason",
          "kind": "value"
        },
        {
          "source": "pr",
          "flag": "--pr",
          "kind": "value"
        },
        {
          "source": "github",
          "flag": "--github",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "session.start",
    "command": {
      "script": "session:start",
      "executionScope": "runtime",
      "branchMode": "none",
      "arguments": [
        {
          "source": "kind",
          "flag": "--kind",
          "kind": "value",
          "required": true
        },
        {
          "source": "path",
          "flag": "--path",
          "kind": "value"
        },
        {
          "source": "area",
          "flag": "--area",
          "kind": "value"
        },
        {
          "source": "stream",
          "flag": "--stream",
          "kind": "value"
        },
        {
          "source": "title",
          "flag": "--title",
          "kind": "value"
        },
        {
          "source": "workflow",
          "flag": "--workflow",
          "kind": "value"
        },
        {
          "source": "bodyFile",
          "flag": "--body-file",
          "kind": "value"
        },
        {
          "source": "startFrom",
          "flag": "--start-from",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "task.start",
    "command": {
      "script": "task:start",
      "branchMode": "none",
      "arguments": [
        {
          "source": "area",
          "flag": "--area",
          "kind": "value"
        },
        {
          "source": "title",
          "flag": "--title",
          "kind": "value"
        },
        {
          "source": "workflow",
          "flag": "--workflow",
          "kind": "value"
        },
        {
          "source": "bodyFile",
          "flag": "--body-file",
          "kind": "value"
        },
        {
          "source": "startFrom",
          "flag": "--start-from",
          "kind": "value"
        },
        {
          "source": "pr",
          "flag": "--pr",
          "kind": "value"
        },
        {
          "source": "github",
          "flag": "--github",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "taskMeta.smoke",
    "command": {
      "script": "task-meta:smoke",
      "branchMode": "none",
      "arguments": []
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
