import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "generate.docs",
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
      "name": "generate.docs",
      "methodPath": [
        "generate",
        "docs"
      ],
      "description": "generate TOOLS.md from the tool manifest",
      "category": "generation",
      "underlying": "workspace generate.docs",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "generate.types",
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
      "name": "generate.types",
      "methodPath": [
        "generate",
        "types"
      ],
      "description": "generate workspace.d.ts from the tool manifest",
      "category": "generation",
      "underlying": "workspace generate.types",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
