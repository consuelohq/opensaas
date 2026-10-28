import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    name: 'posthog.config',
    command: { script: 'posthog', subcommand: 'config', branchMode: 'none', executionScope: 'runtime', jsonFlag: '--json', arguments: [] },
  },
  {
    name: 'posthog.projects',
    command: {
      script: 'posthog', subcommand: 'projects', branchMode: 'none', executionScope: 'runtime', jsonFlag: '--json',
      arguments: [{ source: 'limit', flag: '--limit', kind: 'value' }],
    },
  },
  {
    name: 'posthog.query',
    command: {
      script: 'posthog', subcommand: 'query', branchMode: 'none', executionScope: 'runtime', jsonFlag: '--json',
      arguments: [
        { source: 'sql', flag: '--sql', kind: 'value', required: true },
        { source: 'projectId', flag: '--project-id', kind: 'value' },
        { source: 'limit', flag: '--limit', kind: 'value' },
      ],
    },
  },
  {
    name: 'posthog.capture',
    command: {
      script: 'posthog', subcommand: 'capture', branchMode: 'none', executionScope: 'runtime', jsonFlag: '--json',
      arguments: [
        { source: 'event', flag: '--event', kind: 'value', required: true },
        { source: 'distinctId', flag: '--distinct-id', kind: 'value', required: true },
        { source: 'propertiesJson', flag: '--properties-json', kind: 'value' },
      ],
    },
  },
] as const satisfies readonly ToolHandlerContribution[];
