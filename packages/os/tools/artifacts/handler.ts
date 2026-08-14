import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    name: 'artifacts',
    command: {
      script: 'artifacts',
      branchMode: 'none',
      jsonFlag: '--json',
      dryRunFlag: '--dry-run',
      arguments: [
        { source: 'operation', kind: 'value', required: true },
        { source: 'target', flag: '--target', kind: 'value' },
        { source: 'portlessName', flag: '--portless-name', kind: 'value' },
        { source: 'path', flag: '--path', kind: 'value' },
        { source: 'name', flag: '--name', kind: 'value' },
        { source: 'category', flag: '--category', kind: 'value' },
        { source: 'template', flag: '--template', kind: 'value' },
        { source: 'tailscaleBin', flag: '--tailscale-bin', kind: 'value' },
        { source: 'live', flag: '--live', kind: 'boolean' },
        { source: 'prompt', flag: '--prompt', kind: 'value' },
        { source: 'timeout', flag: '--timeout', kind: 'value' },
        { source: 'id', flag: '--id', kind: 'value' },
        { source: 'versionId', flag: '--version-id', kind: 'value' },
        { source: 'reason', flag: '--reason', kind: 'value' },
        { source: 'baseVersion', flag: '--base-version', kind: 'value' },
        { source: 'forcePublish', flag: '--force-publish', kind: 'boolean' },
        { source: 'schedule', flag: '--schedule', kind: 'value' },
        { source: 'reportFile', flag: '--report-file', kind: 'value' },
        { source: 'workpadFile', flag: '--workpad-file', kind: 'value' },
        { source: 'taskSession', flag: '--task-session', kind: 'value' },
        { source: 'date', flag: '--date', kind: 'value' },
      ],
    },
  },
] as const satisfies readonly ToolHandlerContribution[];
