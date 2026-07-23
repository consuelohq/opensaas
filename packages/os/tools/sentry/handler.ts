import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "sentry.config",
    "command": {
      "script": "sentry",
      "subcommand": "config",
      "branchMode": "none",
      "arguments": [
        {
          "source": "verify",
          "flag": "--verify",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "sentry.event",
    "command": {
      "script": "sentry",
      "subcommand": "event",
      "branchMode": "none",
      "arguments": [
        {
          "source": "eventId",
          "kind": "value",
          "required": true
        },
        {
          "source": "project",
          "flag": "--project",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "sentry.issue",
    "command": {
      "script": "sentry",
      "subcommand": "issue",
      "branchMode": "none",
      "arguments": [
        {
          "source": "identifier",
          "kind": "value",
          "required": true
        },
        {
          "source": "expand",
          "flag": "--expand",
          "kind": "array"
        }
      ]
    }
  },
  {
    "name": "sentry.issueEvent",
    "command": {
      "script": "sentry",
      "subcommand": "issue-event",
      "branchMode": "none",
      "arguments": [
        {
          "source": "issueId",
          "kind": "value",
          "required": true
        },
        {
          "source": "eventId",
          "kind": "value"
        },
        {
          "source": "full",
          "flag": "--full",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "sentry.issues",
    "command": {
      "script": "sentry",
      "subcommand": "issues",
      "branchMode": "none",
      "arguments": [
        {
          "source": "query",
          "flag": "--query",
          "kind": "value"
        },
        {
          "source": "project",
          "flag": "--project",
          "kind": "value"
        },
        {
          "source": "environment",
          "flag": "--environment",
          "kind": "array"
        },
        {
          "source": "sort",
          "flag": "--sort",
          "kind": "value"
        },
        {
          "source": "statsPeriod",
          "flag": "--stats-period",
          "kind": "value"
        },
        {
          "source": "start",
          "flag": "--start",
          "kind": "value"
        },
        {
          "source": "end",
          "flag": "--end",
          "kind": "value"
        },
        {
          "source": "cursor",
          "flag": "--cursor",
          "kind": "value"
        },
        {
          "source": "limit",
          "flag": "--limit",
          "kind": "value"
        },
        {
          "source": "expand",
          "flag": "--expand",
          "kind": "array"
        },
        {
          "source": "collapse",
          "flag": "--collapse",
          "kind": "array"
        }
      ]
    }
  },
  {
    "name": "sentry.projects",
    "command": {
      "script": "sentry",
      "subcommand": "projects",
      "branchMode": "none",
      "arguments": [
        {
          "source": "limit",
          "flag": "--limit",
          "kind": "value"
        },
        {
          "source": "cursor",
          "flag": "--cursor",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "sentry.trace",
    "command": {
      "script": "sentry",
      "subcommand": "trace",
      "branchMode": "none",
      "arguments": [
        {
          "source": "traceId",
          "kind": "value",
          "required": true
        },
        {
          "source": "project",
          "flag": "--project",
          "kind": "value"
        },
        {
          "source": "query",
          "flag": "--query",
          "kind": "value"
        },
        {
          "source": "statsPeriod",
          "flag": "--stats-period",
          "kind": "value"
        },
        {
          "source": "dataset",
          "flag": "--dataset",
          "kind": "value"
        },
        {
          "source": "field",
          "flag": "--field",
          "kind": "array"
        },
        {
          "source": "cursor",
          "flag": "--cursor",
          "kind": "value"
        },
        {
          "source": "limit",
          "flag": "--limit",
          "kind": "value"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
