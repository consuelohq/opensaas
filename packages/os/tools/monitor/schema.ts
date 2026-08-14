import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    name: 'monitor.errors',
    order: [
      'name', 'methodPath', 'description', 'category', 'underlying', 'capabilities',
      'defaultTimeout', 'inputSchema', 'outputSchema', 'command', 'exampleInput', 'sessionRequired',
    ],
    definition: {
      name: 'monitor.errors',
      methodPath: ['monitor', 'errors'],
      description: 'analyze the last 24 hours of canonical Consuelo OS tool traces and classify policy enforcement, caller errors, drift, transient failures, external failures, and defect candidates',
      category: 'observability',
      underlying: 'Consuelo canonical OS trace database and current OS tool contracts',
      capabilities: { readOnly: true, mutating: false, deterministic: false, safeToRetry: true },
      defaultTimeout: 120000,
      inputSchema: 'EmptyInput',
      outputSchema: 'RawOutput',
      exampleInput: {},
      sessionRequired: false,
    },
  },
] as const satisfies readonly ToolSchemaContribution[];
