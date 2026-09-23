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
        'start or resume a durable Consuelo OS release operation: use for release to canary or another channel; pass the main-targeting review PR for the stream, receive an operation id immediately, then use status/logs/attach/resume without keeping one MCP call open; the worker verifies and merges to main, resolves the exact merged SHA immutable runtime release even if dev advances, promotes through dev/canary/beta/stable as requested, then by default updates this node to the exact released version and verifies it',
      category: 'release',
      underlying: 'workspace release',
      capabilities: {
        readOnly: false,
        mutating: true,
        deterministic: false,
        safeToRetry: true,
      },
      defaultTimeout: 30_000,
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
