import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    name: 'lifecycle.status',
    command: {
      script: 'lifecycle',
      executionScope: 'runtime',
      subcommand: 'status',
      branchMode: 'none',
      jsonFlag: '--json',
      arguments: [],
    },
  },
  {
    name: 'lifecycle.update',
    command: {
      script: 'lifecycle',
      executionScope: 'runtime',
      subcommand: 'update',
      branchMode: 'none',
      jsonFlag: '--json',
      arguments: [
        {
          source: 'channel',
          flag: '--channel',
          kind: 'value',
        },
        {
          source: 'version',
          flag: '--version',
          kind: 'value',
        },
      ],
    },
  },
] satisfies ToolHandlerContribution[];
