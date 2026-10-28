import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    name: 'monitor.errors',
    command: {
      script: 'monitor:errors',
      branchMode: 'optional',
      arguments: [],
    },
  },
] as const satisfies readonly ToolHandlerContribution[];
