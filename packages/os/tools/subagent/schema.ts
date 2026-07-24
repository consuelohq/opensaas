import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "subagent",
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
      "keywords"
    ],
    "definition": {
      "name": "subagent",
      "methodPath": [
        "subagent"
      ],
      "description": "run a subagent with a tmp instruction file. use only when the user asks for subagents. always get alignment on what model and harness, and tell the user the options if they did not specify. core steering is applied by default; media steering replaces core steering only when explicitly flagged. always write instructions to tmp first and call the subagent to read the tmp. always read your handoff skill to learn how to properly prompt another agent. return one compact trace-style summary with traceId, files read, files edited, and tools called.",
      "category": "subagent",
      "underlying": "workspace subagent",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "SubagentInput",
      "outputSchema": "SubagentOutput",
      "exampleInput": {
        "provider": "grok",
        "bundle": "media",
        "policy": "read",
        "instructionPath": "/tmp/ko-social.md",
        "outputFormat": "json"
      },
      "sessionRequired": false,
      "keywords": [
        "subagent",
        "delegate",
        "model",
        "agent",
        "grok",
        "codex",
        "opencode",
        "pi"
      ]
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
