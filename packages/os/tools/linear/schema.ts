import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "linear.createIssue",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "linear.createIssue",
      "methodPath": [
        "linear",
        "createIssue"
      ],
      "description": "create a Linear issue with DEV/open defaults and the opensaas label",
      "category": "linear",
      "underlying": "workspace linear.createIssue",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearCreateIssueInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "title": "add Linear facade commands",
        "labels": [
          "opensaas"
        ]
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.issue",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "linear.issue",
      "methodPath": [
        "linear",
        "issue"
      ],
      "description": "read a Linear issue by identifier or id",
      "category": "linear",
      "underlying": "workspace linear.issue",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearIssueInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "identifier": "DEV-123"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.labels",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "linear.labels",
      "methodPath": [
        "linear",
        "labels"
      ],
      "description": "list Linear issue labels for label consistency",
      "category": "linear",
      "underlying": "workspace linear.labels",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "first": 50
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.projects",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "linear.projects",
      "methodPath": [
        "linear",
        "projects"
      ],
      "description": "list Linear projects and ids",
      "category": "linear",
      "underlying": "workspace linear.projects",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "first": 50
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.search",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "linear.search",
      "methodPath": [
        "linear",
        "search"
      ],
      "description": "search Linear issues with DEV default team support",
      "category": "linear",
      "underlying": "workspace linear.search",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearSearchInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "search": "workspace facade"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.states",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "linear.states",
      "methodPath": [
        "linear",
        "states"
      ],
      "description": "list workflow states for a Linear team",
      "category": "linear",
      "underlying": "workspace linear.states",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearTeamScopedListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "team": "dev"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.teams",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "linear.teams",
      "methodPath": [
        "linear",
        "teams"
      ],
      "description": "list Linear teams and workflow states",
      "category": "linear",
      "underlying": "workspace linear.teams",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "first": 20
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.updateIssue",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "linear.updateIssue",
      "methodPath": [
        "linear",
        "updateIssue"
      ],
      "description": "update Linear issue fields including labels, project, cycle, and parent",
      "category": "linear",
      "underlying": "workspace linear.updateIssue",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearUpdateIssueInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "issueId": "DEV-123",
        "labels": [
          "opensaas"
        ]
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
