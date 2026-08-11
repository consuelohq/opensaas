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
      "description": "search Consuelo OS tools with deterministic domain-first retrieval and bounded semantic fallback",
      "category": "tooling",
      "underlying": "Consuelo OS tools.search",
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
