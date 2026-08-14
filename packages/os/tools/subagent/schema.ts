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
      "description": "run or start a subagent from an instruction handoff. Write the handoff to OS tmp first under the canonical opensaas-handoffs root; model and reasoning selection are provider-specific and surfaced explicitly. Edit self-bootstrap may call task.start first, or an existing taskSession may be supplied. task.push publishes only the task branch. task.pr merges to the stream and must not be called when the handoff says stop after push. status/wait/logs attach to an existing run and never spawn; cancel targets runId. requestId makes retries idempotent. Provider capability limitations are returned explicitly and never silently weakened. Return one compact trace-style summary with traceId, files read, files edited, tools called, and token usage.",
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
        "action": "start",
        "provider": "codex",
        "model": "gpt-5.6-luna",
        "reasoningEffort": "xhigh",
        "policy": "edit",
        "instructionPath": "/tmp/opensaas-handoffs/repair.md",
        "requestId": "req_repair_once",
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
