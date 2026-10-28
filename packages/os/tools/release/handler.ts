import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    name: 'release',
    command: {
      script: 'release',
      executionScope: 'runtime',
      branchMode: 'none',
      jsonFlag: '--json',
      arguments: [
        { source: 'action', flag: '--action', kind: 'value' },
        { source: 'pr', flag: '--pr', kind: 'value' },
        { source: 'repo', flag: '--repo', kind: 'value' },
        { source: 'channel', flag: '--channel', kind: 'value' },
        { source: 'mergeMethod', flag: '--merge-method', kind: 'value' },
        { source: 'releaseOnly', flag: '--release-only', kind: 'boolean' },
        { source: 'operationId', flag: '--operation-id', kind: 'value' },
        { source: 'tailLines', flag: '--tail-lines', kind: 'value' },
      ],
    },
  },
] satisfies ToolHandlerContribution[];
