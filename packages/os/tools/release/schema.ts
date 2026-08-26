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
    name: 'release',
    order,
    definition: {
      name: 'release',
      methodPath: ['release'],
      description:
        'release a Consuelo OS PR end-to-end: verify and merge it to main, wait for the exact merged SHA runtime publication, promote that exact immutable bundle through dev/canary/beta/stable as requested, then by default update this node to the exact released version and verify it; use when Ko says release, deploy this PR, release to canary, or release and update',
      category: 'release',
      underlying: 'workspace release',
      capabilities: {
        readOnly: false,
        mutating: true,
        deterministic: false,
        safeToRetry: false,
      },
      defaultTimeout: 1_200_000,
      inputSchema: 'ReleaseInput',
      outputSchema: 'RawOutput',
      search: {
        keywords: [
          'release',
          'deploy this pr',
          'release to canary',
          'release to beta',
          'release to production',
          'release to stable',
          'release and update',
          'ship pr',
          'promote runtime',
          'update local after release',
          'consuelo os release',
        ],
        entities: ['Consuelo OS', 'runtime release', 'release channel', 'GitHub PR'],
      },
      exampleInput: { pr: 2185, channel: 'canary' },
      sessionRequired: false,
    },
  },
] satisfies ToolSchemaContribution[];
