import type { ToolSchemaContribution } from '../package';

const order = [
  'name',
  'methodPath',
  'description',
  'category',
  'underlying',
  'capabilities',
  'defaultTimeout',
  'inputSchema',
  'outputSchema',
  'search',
  'command',
  'exampleInput',
  'sessionRequired',
] as const;

export const toolSchemas = [
  {
    name: 'lifecycle.status',
    order,
    definition: {
      name: 'lifecycle.status',
      methodPath: ['lifecycle', 'status'],
      description:
        'check Consuelo OS lifecycle and runtime status, including the latest durable update operation',
      category: 'lifecycle',
      underlying: 'workspace lifecycle.status',
      capabilities: {
        readOnly: true,
        mutating: false,
        deterministic: false,
        safeToRetry: true,
      },
      defaultTimeout: 60_000,
      inputSchema: 'EmptyInput',
      outputSchema: 'RawOutput',
      search: {
        keywords: [
          'consuelo',
          'os',
          'runtime',
          'release',
          'lifecycle',
          'status',
          'update status',
          'upgrade status',
        ],
        entities: ['consuelo os', 'runtime release', 'lifecycle operation'],
      },
      exampleInput: {},
      sessionRequired: false,
    },
  },
  {
    name: 'lifecycle.update',
    order,
    definition: {
      name: 'lifecycle.update',
      methodPath: ['lifecycle', 'update'],
      description:
        'update or upgrade the installed Consuelo OS runtime with the canonical signed lifecycle updater; optionally require an exact released version',
      category: 'lifecycle',
      underlying: 'workspace lifecycle.update',
      capabilities: {
        readOnly: false,
        mutating: true,
        deterministic: false,
        safeToRetry: false,
      },
      defaultTimeout: 120_000,
      inputSchema: 'LifecycleUpdateInput',
      outputSchema: 'RawOutput',
      search: {
        keywords: [
          'consuelo',
          'os',
          'runtime',
          'release',
          'lifecycle',
          'update',
          'upgrade',
          'updater',
          'install latest',
          'exact version',
          'pin version',
        ],
        entities: ['consuelo os', 'runtime release', 'lifecycle updater'],
      },
      exampleInput: { channel: 'stable' },
      sessionRequired: false,
    },
  },
] satisfies ToolSchemaContribution[];
