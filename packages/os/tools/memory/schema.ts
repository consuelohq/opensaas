import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "memory",
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
      "name": "memory",
      "methodPath": [
        "memory"
      ],
      "description": "search, read, save, list, and inspect local project memory and workspace traces",
      "category": "memory",
      "underlying": "workspace memory",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "MemoryInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "operation": "search",
        "keyword": "workspace",
        "limit": 3
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
