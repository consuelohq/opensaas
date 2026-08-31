import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    name: 'security.scan',
    command: {
      script: 'security:scan',
      branchMode: 'optional',
      arguments: [],
    },
  },
] as const satisfies readonly ToolHandlerContribution[];
