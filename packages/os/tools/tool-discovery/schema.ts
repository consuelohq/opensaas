import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "tools.search",
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
      "workflowRole"
    ],
    "definition": {
      "name": "tools.search",
      "methodPath": [
        "tools",
        "search"
      ],
      "description": "search workspace tools by intent and return ranked usage guidance",
      "category": "tooling",
      "underlying": "workspace tools.search",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ToolsSearchInput",
      "outputSchema": "ToolsSearchOutput",
      "exampleInput": {
        "query": "linear issue",
        "limit": 5
      },
      "workflowRole": "tool.search"
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
