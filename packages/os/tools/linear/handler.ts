import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "linear.createIssue",
    "command": {
      "script": "linear",
      "subcommand": "create",
      "branchMode": "none",
      "arguments": [
        {
          "source": "title",
          "kind": "value"
        },
        {
          "source": "description",
          "flag": "--description",
          "kind": "value"
        },
        {
          "source": "team",
          "flag": "--team",
          "kind": "value"
        },
        {
          "source": "state",
          "flag": "--state",
          "kind": "value"
        },
        {
          "source": "labels",
          "flag": "--labels",
          "kind": "array"
        },
        {
          "source": "priority",
          "flag": "--priority",
          "kind": "value"
        },
        {
          "source": "assignee",
          "flag": "--assignee",
          "kind": "value"
        },
        {
          "source": "project",
          "flag": "--project",
          "kind": "value"
        },
        {
          "source": "cycle",
          "flag": "--cycle",
          "kind": "value"
        },
        {
          "source": "parent",
          "flag": "--parent",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "linear.issue",
    "command": {
      "script": "linear",
      "subcommand": "issue",
      "branchMode": "none",
      "arguments": [
        {
          "source": "identifier",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "linear.labels",
    "command": {
      "script": "linear",
      "subcommand": "labels",
      "branchMode": "none",
      "arguments": [
        {
          "source": "first",
          "flag": "--first",
          "kind": "value"
        },
        {
          "source": "after",
          "flag": "--after",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "linear.projects",
    "command": {
      "script": "linear",
      "subcommand": "projects",
      "branchMode": "none",
      "arguments": [
        {
          "source": "first",
          "flag": "--first",
          "kind": "value"
        },
        {
          "source": "after",
          "flag": "--after",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "linear.search",
    "command": {
      "script": "linear",
      "subcommand": "search",
      "branchMode": "none",
      "arguments": [
        {
          "source": "search",
          "flag": "--search",
          "kind": "value"
        },
        {
          "source": "team",
          "flag": "--team",
          "kind": "value"
        },
        {
          "source": "first",
          "flag": "--first",
          "kind": "value"
        },
        {
          "source": "after",
          "flag": "--after",
          "kind": "value"
        },
        {
          "source": "filter",
          "flag": "--filter",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "linear.states",
    "command": {
      "script": "linear",
      "subcommand": "states",
      "branchMode": "none",
      "arguments": [
        {
          "source": "team",
          "flag": "--team",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "linear.teams",
    "command": {
      "script": "linear",
      "subcommand": "teams",
      "branchMode": "none",
      "arguments": [
        {
          "source": "first",
          "flag": "--first",
          "kind": "value"
        },
        {
          "source": "after",
          "flag": "--after",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  },
  {
    "name": "linear.updateIssue",
    "command": {
      "script": "linear",
      "subcommand": "update",
      "branchMode": "none",
      "arguments": [
        {
          "source": "issueId",
          "kind": "value"
        },
        {
          "source": "title",
          "flag": "--title",
          "kind": "value"
        },
        {
          "source": "description",
          "flag": "--description",
          "kind": "value"
        },
        {
          "source": "state",
          "flag": "--state",
          "kind": "value"
        },
        {
          "source": "labels",
          "flag": "--labels",
          "kind": "array"
        },
        {
          "source": "priority",
          "flag": "--priority",
          "kind": "value"
        },
        {
          "source": "assignee",
          "flag": "--assignee",
          "kind": "value"
        },
        {
          "source": "project",
          "flag": "--project",
          "kind": "value"
        },
        {
          "source": "cycle",
          "flag": "--cycle",
          "kind": "value"
        },
        {
          "source": "parent",
          "flag": "--parent",
          "kind": "value"
        }
      ],
      "jsonFlag": "--json"
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
