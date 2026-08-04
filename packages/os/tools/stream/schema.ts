import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "stream.context",
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
      "sessionRequired",
      "workflowRole"
    ],
    "definition": {
      "name": "stream.context",
      "methodPath": [
        "stream",
        "context"
      ],
      "description": "show recent stream context",
      "category": "stream",
      "underlying": "workspace stream.context",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "StreamInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "area": "workspace-agents"
      },
      "sessionRequired": false,
      "workflowRole": "stream.context"
    }
  },
  {
    "name": "stream.create",
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
      "sessionRequired",
      "workflowRole"
    ],
    "definition": {
      "name": "stream.create",
      "methodPath": [
        "stream",
        "create"
      ],
      "description": "create a durable stream branch with OS and Workspace instruction files",
      "category": "stream",
      "underlying": "workspace stream.create",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "StreamCreateInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "area": "research",
        "sourceBranch": "main"
      },
      "sessionRequired": false,
      "workflowRole": "stream.create"
    }
  },
  {
    "name": "stream.list",
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
      "name": "stream.list",
      "methodPath": [
        "stream",
        "list"
      ],
      "description": "list stream branches",
      "category": "stream",
      "underlying": "workspace stream.list",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "StreamListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  },
  {
    "name": "stream.sync",
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
      "name": "stream.sync",
      "methodPath": [
        "stream",
        "sync"
      ],
      "description": "sync a stream branch with main",
      "category": "stream",
      "underlying": "workspace stream.sync",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "StreamInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "area": "workspace-agents",
        "dryRun": true
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
