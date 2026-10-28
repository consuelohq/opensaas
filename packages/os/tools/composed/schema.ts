import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "batch",
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
      "name": "batch",
      "methodPath": [
        "batch"
      ],
      "description": "run multiple workspace tools sequentially or in parallel with compact per-step results",
      "category": "composed",
      "underlying": "workspace batch",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BatchInput",
      "outputSchema": "BatchOutput",
      "exampleInput": {
        "steps": [
          {
            "tool": "memory",
            "input": {
              "operation": "find",
              "keyword": "workspace",
              "limit": 1
            }
          }
        ]
      },
      "sessionRequired": false,
      "workflowRole": "tool.batch"
    }
  },
  {
    "name": "checkFiles",
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
      "name": "checkFiles",
      "methodPath": [
        "checkFiles"
      ],
      "description": "run syntax checks over a set of files through code.call in the task worktree",
      "category": "composed",
      "underlying": "workspace checkFiles",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "CheckFilesInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "files": [
          "packages/os/scripts/fs.js"
        ],
        "stopOnFirstError": true
      },
      "sessionRequired": true
    }
  },
  {
    "name": "editFlow",
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
      "name": "editFlow",
      "methodPath": [
        "editFlow"
      ],
      "description": "run a search-read-patch-verify flow as a composed script",
      "category": "composed",
      "underlying": "workspace editFlow",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EditFlowInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "searchPattern": "oldFn",
        "searchPaths": [
          "packages/os/scripts"
        ],
        "from": 1,
        "to": 1,
        "contentFile": "/tmp/new.ts",
        "dryRun": true
      },
      "sessionRequired": true
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
