import type { ToolHandlerContribution } from '../package';

const value = (source: string, flag: string, required = false) => ({
  source,
  flag,
  kind: 'value' as const,
  ...(required ? { required: true } : {}),
});
const bool = (source: string, flag: string) => ({ source, flag, kind: 'boolean' as const });
const array = (source: string, flag?: string) => ({
  source,
  ...(flag ? { flag } : {}),
  kind: 'commandArray' as const,
});

const provider = value('provider', '--provider', true);
const approval = [
  bool('approved', '--approved'),
  value('approvalReason', '--approval-reason'),
] as const;
const timeout = value('timeout', '--timeout-ms');

export const toolHandlers = [
  {
    name: 'deployment.detect',
    command: {
      script: 'deployment',
      internal: 'deployment',
      subcommand: 'detect',
      branchMode: 'none',
      arguments: [provider],
      jsonFlag: '--json',
    },
  },
  {
    name: 'deployment.context',
    command: {
      script: 'deployment',
      internal: 'deployment',
      subcommand: 'context',
      branchMode: 'none',
      arguments: [provider, value('action', '--action', true), timeout],
      jsonFlag: '--json',
    },
  },
  {
    name: 'deployment.list',
    command: {
      script: 'deployment',
      internal: 'deployment',
      subcommand: 'list',
      branchMode: 'none',
      arguments: [
        provider,
        value('resource', '--resource', true),
        value('projectId', '--project-id'),
        value('environment', '--environment'),
        value('serviceId', '--service-id'),
        value('cursor', '--cursor'),
        value('limit', '--limit'),
        timeout,
      ],
      jsonFlag: '--json',
    },
  },
  {
    name: 'deployment.status',
    command: {
      script: 'deployment',
      internal: 'deployment',
      subcommand: 'status',
      branchMode: 'none',
      arguments: [
        provider,
        value('deploymentId', '--deployment-id', true),
        value('serviceId', '--service-id'),
        value('environment', '--environment'),
        timeout,
      ],
      jsonFlag: '--json',
    },
  },
  {
    name: 'deployment.logs',
    command: {
      script: 'deployment',
      internal: 'deployment',
      subcommand: 'logs',
      branchMode: 'none',
      arguments: [
        provider,
        value('deploymentId', '--deployment-id'),
        value('serviceId', '--service-id'),
        value('environment', '--environment'),
        value('cursor', '--cursor'),
        value('limit', '--limit'),
        value('since', '--since'),
        value('until', '--until'),
        value('filter', '--filter'),
        value('kind', '--kind'),
        bool('latest', '--latest'),
        timeout,
      ],
      jsonFlag: '--json',
    },
  },
  {
    name: 'deployment.deploy',
    command: {
      script: 'deployment',
      internal: 'deployment',
      subcommand: 'deploy',
      branchMode: 'none',
      arguments: [
        provider,
        value('action', '--action', true),
        value('target', '--target'),
        value('projectId', '--project-id'),
        value('serviceId', '--service-id'),
        value('source', '--source'),
        value('deploymentId', '--deployment-id'),
        value('environment', '--environment'),
        bool('wait', '--wait'),
        ...approval,
        timeout,
      ],
      jsonFlag: '--json',
    },
  },
  {
    name: 'deployment.environment',
    command: {
      script: 'deployment',
      internal: 'deployment',
      subcommand: 'environment',
      branchMode: 'none',
      arguments: [
        provider,
        value('action', '--action', true),
        value('name', '--name'),
        value('value', '--value'),
        value('scope', '--scope'),
        value('projectId', '--project-id'),
        value('environment', '--environment'),
        value('serviceId', '--service-id'),
        bool('skipDeploys', '--skip-deploys'),
        ...approval,
        timeout,
      ],
      jsonFlag: '--json',
    },
  },
  {
    name: 'deployment.raw',
    command: {
      script: 'deployment',
      internal: 'deployment',
      subcommand: 'raw',
      branchMode: 'none',
      arguments: [provider, array('args', '--arg'), ...approval, timeout],
      jsonFlag: '--json',
    },
  },
] as const satisfies readonly ToolHandlerContribution[];
