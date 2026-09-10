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
        { source: 'pr', flag: '--pr', kind: 'value', required: true },
        { source: 'repo', flag: '--repo', kind: 'value' },
        { source: 'channel', flag: '--channel', kind: 'value' },
        { source: 'mergeMethod', flag: '--merge-method', kind: 'value' },
        { source: 'releaseOnly', flag: '--release-only', kind: 'boolean' },
      ],
    },
  },
] satisfies ToolHandlerContribution[];
