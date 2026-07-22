import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "http",
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
      "name": "http",
      "methodPath": [
        "fs",
        "http"
      ],
      "description": "make HTTP requests through the workspace http wrapper (wraps xh)",
      "category": "http",
      "underlying": "workspace http",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "HttpInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "method": "get",
        "url": "https://example.com"
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
