import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    name: 'dailySchedules.publish',
    command: {
      script: 'daily-schedules',
      branchMode: 'none',
      arguments: [
        { source: 'kind', flag: '--kind', kind: 'value', required: true },
        { source: 'sourceFile', flag: '--source-file', kind: 'value' },
        { source: 'content', flag: '--content', kind: 'value' },
        { source: 'format', flag: '--format', kind: 'value' },
        { source: 'date', flag: '--date', kind: 'value' },
        { source: 'title', flag: '--title', kind: 'value' },
      ],
    },
  },
] as const satisfies readonly ToolHandlerContribution[];
