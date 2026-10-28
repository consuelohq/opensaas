import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    name: 'dailySchedules.publish',
    order: [
      'name', 'methodPath', 'description', 'category', 'underlying', 'capabilities',
      'defaultTimeout', 'inputSchema', 'outputSchema', 'command', 'exampleInput', 'sessionRequired',
    ],
    definition: {
      name: 'dailySchedules.publish',
      methodPath: ['dailySchedules', 'publish'],
      description: 'publish one dated security or self-healing report/workpad into the private Daily Schedules artifact and refresh its link index',
      category: 'artifacts',
      underlying: 'Consuelo durable artifact catalog',
      capabilities: { readOnly: false, mutating: true, deterministic: false, safeToRetry: false },
      defaultTimeout: 120000,
      inputSchema: 'DailySchedulesPublishInput',
      outputSchema: 'RawOutput',
      exampleInput: { kind: 'security-workpad', sourceFile: '/tmp/security-workpad.md' },
      sessionRequired: false,
    },
  },
] as const satisfies readonly ToolSchemaContribution[];
