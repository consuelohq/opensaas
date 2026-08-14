import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    name: 'artifacts',
    order: [
      'name', 'methodPath', 'description', 'category', 'underlying', 'capabilities',
      'defaultTimeout', 'inputSchema', 'outputSchema', 'search', 'command', 'exampleInput',
      'sessionRequired', 'workflowRole',
    ],
    definition: {
      name: 'artifacts',
      methodPath: ['artifacts'],
      description: 'canonical typed artifact facade; choose an operation for archive, generation, design-runtime, or Daily Schedules publication work',
      category: 'artifacts',
      underlying: 'OS artifacts operation facade (Effect-backed execution boundary)',
      capabilities: { readOnly: false, mutating: true, deterministic: false, safeToRetry: false },
      defaultTimeout: 600000,
      inputSchema: 'ArtifactsOperationInput',
      outputSchema: 'RawOutput',
      search: {
        domainAliases: ['artifact', 'daily schedules', 'design'],
        keywords: [
          'publish artifact', 'daily schedules', 'security report', 'self healing report',
          'design system', 'artifact history', 'generate website', 'generate eguide', 'open design',
        ],
      },
      exampleInput: { operation: 'list' },
      sessionRequired: false,
      workflowRole: 'artifacts',
    },
  },
] as const satisfies readonly ToolSchemaContribution[];
