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

export const toolHandlers = [
  {
    name: 'google',
    command: {
      script: 'google',
      branchMode: 'none',
      arguments: [
        value('action', '--action', true),
        array('args', '--arg'),
        value('account', '--account'),
        value('mode', '--mode'),
        bool('approved', '--approved'),
        value('approvalReason', '--approval-reason'),
        value('timeoutMs', '--timeout-ms'),
      ],
      jsonFlag: '--json',
    },
  },
] as const satisfies readonly ToolHandlerContribution[];
