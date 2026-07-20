#!/usr/bin/env bun

import fs from 'node:fs';
import {
  cancel,
  groupMultiselect,
  isCancel,
  multiselect,
  note,
  select,
  text,
} from '@clack/prompts';

import {
  getDefaultSelectedSkillNames,
  getGroupedOnboardingSkillOptions,
} from './lib/onboarding-skills';
import {
  info,
  printEnd,
  printOsBanner,
  spinner,
  success,
  type OsBannerStep,
} from './lib/cli-ui';
import {
  detectAgents,
  provisionLocalOs,
  readLocalNodeIdentity,
  resolveOsHome,
  type AgentName,
  type OsMode,
  type WorkspaceBootstrap,
} from './lib/install-state';
import {
  pollWorkspaceDeviceAccessToken,
  requestWorkspaceDeviceCode,
  selectWorkspaceForDeviceLogin,
  type WorkspaceDeviceKeyPair,
} from './lib/workspace-device-login-client';
import {
  createInstallDiagnostics,
  type InstallDiagnostics,
  type InstallDiagnosticStatus,
} from './lib/install-diagnostics';
import { resolveLocalOsPortOverride } from './server/env';
type ArtifactMode = 'local';
type SkillName = string;
type InstallerProgressStep =
  | 'dependencies'
  | 'workspace'
  | 'security'
  | 'skills'
  | 'agents'
  | 'service'
  | 'health';
type InstallOptions = {
  dryRun: boolean;
  yes: boolean;
  json: boolean;
  quiet: boolean;
  checkTty: boolean;
  installDaemons: boolean;
  skipDaemons: boolean;
  home?: string;
  mode?: OsMode;
  workspaceName?: string;
  workspaceHost?: string;
  workspaceSlug?: string;
  workspaceBootstrap?: WorkspaceBootstrap;
  deviceLoginStatus?: 'approved' | 'fallback' | 'skipped' | 'workspace_required';
  deviceLoginUrl?: string;
  artifactMode: ArtifactMode;
  selectedSkills: SkillName[];
  connectAgents: AgentName[];
};
type InstallPlatformProvisioningPayload =
  | {
      status: 'planned';
      workspaceHost?: string;
      message: string;
    }
  | {
      status: 'managed';
      workspaceId: string;
      workspaceSlug: string;
      workspaceHost: string;
      message: string;
    }
  | {
      status: 'skipped';
      workspaceHost?: string;
      message: string;
    };

const AGENT_NAME_LIST: AgentName[] = [
  'codex',
  'cursor',
  'claude',
  'opencode',
  'factory',
  'gemini',
  'pi',
];
const AGENT_NAMES = new Set<AgentName>(AGENT_NAME_LIST);
export const INSTALLER_PROGRESS_STEPS: InstallerProgressStep[] = [
  'dependencies',
  'workspace',
  'security',
  'skills',
  'agents',
  'service',
  'health',
];

type InstallerDiagnosticStep =
  | InstallerProgressStep
  | 'process_lifecycle'
  | 'dependencies'
  | 'device_login'
  | 'workspace_selection';

function recordInstallerStep(
  diagnostics: InstallDiagnostics,
  step: InstallerDiagnosticStep,
  status: InstallDiagnosticStatus,
  data?: Record<string, unknown>,
): void {
  diagnostics.recordStep(step, status, data);
}

function recordPromptDecision(
  diagnostics: InstallDiagnostics,
  name: string,
  value: unknown,
): void {
  diagnostics.recordPromptDecision(name, value);
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type InstallerDiagnosticsLifecycleTarget = {
  once: (event: string, handler: (...args: unknown[]) => void) => unknown;
};

type InstallerDiagnosticsLifecycleOptions = {
  kill?: (pid: number, signal: NodeJS.Signals) => unknown;
  pid?: number;
};

let installerDiagnosticsLifecycleHooksRegistered = false;

export function registerInstallerDiagnosticsLifecycleHooks(
  diagnostics: InstallDiagnostics,
  lifecycleTarget: InstallerDiagnosticsLifecycleTarget = process,
  options: InstallerDiagnosticsLifecycleOptions = {},
): void {
  const isProcessTarget = lifecycleTarget === process;
  if (!diagnostics.enabled || (isProcessTarget && installerDiagnosticsLifecycleHooksRegistered)) return;
  if (isProcessTarget) installerDiagnosticsLifecycleHooksRegistered = true;

  const kill = options.kill ?? ((pid: number, signal: NodeJS.Signals) => process.kill(pid, signal));
  const processId = options.pid ?? process.pid;

  lifecycleTarget.once('beforeExit', (exitCode) => {
    recordInstallerStep(diagnostics, 'process_lifecycle', 'beforeExit', { exitCode });
  });
  lifecycleTarget.once('exit', (exitCode) => {
    recordInstallerStep(diagnostics, 'process_lifecycle', 'exit', { exitCode });
  });
  lifecycleTarget.once('uncaughtExceptionMonitor', (error) => {
    recordInstallerStep(diagnostics, 'process_lifecycle', 'uncaughtException', {
      error: formatUnknownError(error),
    });
  });

  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
    lifecycleTarget.once(signal, () => {
      recordInstallerStep(diagnostics, 'process_lifecycle', 'signal', { signal });
      kill(processId, signal);
    });
  }
}
export function createInstallerProgressSteps(
  activeStep: InstallerProgressStep | null,
): OsBannerStep[] {
  if (activeStep === null) {
    return INSTALLER_PROGRESS_STEPS.map((label) => ({ label, state: 'complete' }));
  }

  const activeIndex = INSTALLER_PROGRESS_STEPS.indexOf(activeStep);
  return INSTALLER_PROGRESS_STEPS.map((label, index) => ({
    label,
    state:
      index < activeIndex
        ? 'complete'
        : index === activeIndex
          ? 'active'
          : 'pending',
  }));
}

export function formatLocalAgentsPromptMessage(count: number): string {
  return `${count} agents found — press Space to not connect to this workspace, Enter to continue`;
}

export function renderInstallerProgress(activeStep: InstallerProgressStep | null): void {
  printOsBanner(createInstallerProgressSteps(activeStep));
}

function writeStdout(value: string): void {
  process.stdout.write(value);
}

const WORKSPACE_BASE_DOMAIN = 'consuelohq.com';
const DEVICE_LOGIN_CLIENT_ID = 'consuelo-os-installer';
const DEVICE_LOGIN_SCOPE = ['workspace:read', 'os:connector:register'];
const DEVICE_LOGIN_POLL_TIMEOUT_MS = 5 * 60 * 1000;

function normalizeWorkspaceHost(value: string): string {
  const raw = value.trim();
  const withProtocol = raw.includes('://') ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  const hostname = url.hostname.toLowerCase();

  if (hostname.length === 0 || !hostname.includes('.')) {
    throw new Error('workspace host must include a valid hostname');
  }

  return hostname;
}

function normalizeWorkspaceName(value: string): string {
  const workspaceName = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (workspaceName.length === 0) {
    throw new Error('workspace name is required');
  }

  return workspaceName;
}

function workspaceHostFromSlug(workspaceSlug: string): string {
  return `${workspaceSlug}.${WORKSPACE_BASE_DOMAIN}`;
}

function normalizeWorkspaceSlug(value: string): string {
  return normalizeWorkspaceName(value);
}

function createManualWorkspaceBootstrap(input: {
  workspaceSlug: string;
  workspaceHost: string;
}): WorkspaceBootstrap {
  const workspaceSlug = normalizeWorkspaceSlug(input.workspaceSlug);
  const workspaceHost = normalizeWorkspaceHost(input.workspaceHost);
  const safeIdSegment = workspaceSlug.replace(/-/g, '_');

  return {
    workspaceId: `workspace_${safeIdSegment}`,
    workspaceSlug,
    workspaceHost,
    connectorId: `connector_${safeIdSegment}`,
    connectorTransport: 'websocket-relay',
  };
}

function maybeCreateWorkspaceBootstrap(options: InstallOptions): WorkspaceBootstrap | undefined {
  if (options.workspaceBootstrap) return options.workspaceBootstrap;
  if (!options.workspaceHost || !options.workspaceSlug) return undefined;

  return createManualWorkspaceBootstrap({
    workspaceHost: options.workspaceHost,
    workspaceSlug: options.workspaceSlug,
  });
}

function parseArgs(argv: string[]): InstallOptions {
  const options: InstallOptions = {
    dryRun: false,
    yes: false,
    json: false,
    quiet: false,
    checkTty: false,
    installDaemons: false,
    skipDaemons: false,
    artifactMode: 'local',
    selectedSkills: getDefaultSelectedSkillNames(),
    connectAgents: [],
  };

  const readValue = (flag: string, index: number): string => {
    const value = argv[index + 1];
    if (!value || value.startsWith('-')) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--check-tty') options.checkTty = true;
    else if (arg === '--install-daemons') options.installDaemons = true;
    else if (arg === '--skip-daemons') options.skipDaemons = true;
    else if (arg === '--home') {
      options.home = readValue('--home', index);
      index += 1;
    } else if (arg === '--mode') {
      const mode = readValue('--mode', index);
      index += 1;
      if (mode !== 'local' && mode !== 'cloud')
        throw new Error('--mode must be local or cloud');
      options.mode = mode;
    } else if (arg === '--workspace-name') {
      const workspaceName = normalizeWorkspaceName(readValue('--workspace-name', index));
      index += 1;
      options.workspaceName = workspaceName;
      options.workspaceSlug = workspaceName;
      options.workspaceHost = workspaceHostFromSlug(workspaceName);
    } else if (arg === '--workspace-url') {
      options.workspaceHost = normalizeWorkspaceHost(readValue('--workspace-url', index));
      index += 1;
    } else if (arg === '--workspace-slug') {
      options.workspaceSlug = normalizeWorkspaceSlug(readValue('--workspace-slug', index));
      options.workspaceName = options.workspaceSlug;
      index += 1;
    } else if (arg === '--connect-agent') {
      const agent = readValue('--connect-agent', index) as AgentName;
      index += 1;
      if (!AGENT_NAMES.has(agent))
        throw new Error(
          `--connect-agent must be ${AGENT_NAME_LIST.join(', ')}`,
        );
      options.connectAgents.push(agent);
    } else if (arg === '--connect-agents') {
      options.connectAgents = [...AGENT_NAME_LIST];
    } else if (arg === '--help' || arg === '-h') {
      writeStdout(
        [
          'usage: bun ./scripts/install.ts [--yes] [--dry-run] [--home <path>] [--mode local|cloud]',
          '',
          'Consuelo OS runs a local background service on your Mac so agents and apps can reach your OS while you work. This is similar to common Mac utilities that run in the background. You can stop or uninstall it later.',
          '',
          'Options:',
          '  --yes                 run without prompts',
          '  --dry-run             print planned writes without writing',
          '  --home <path>         override OS home',
          '  --mode <mode>         local or cloud',
          '  --workspace-name <name> workspace name',
          `  --connect-agent <id>  connect ${AGENT_NAME_LIST.join(', ')}`,
          '  --connect-agents      connect detected local agents',
          '  --json                machine-readable output',
          '  --quiet               reduce human output',
          '  --check-tty          print safe terminal diagnostics',
          '',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

function getTtyDiagnostics() {
  const stdinWithRawMode = process.stdin as typeof process.stdin & {
    setRawMode?: (enabled: boolean) => typeof process.stdin;
  };

  return {
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    stderrIsTTY: Boolean(process.stderr.isTTY),
    canSetRawMode: typeof stdinWithRawMode.setRawMode === 'function',
    term: process.env.TERM ?? '',
    ci: process.env.CI ?? '',
  };
}

function printTtyDiagnostics(): void {
  writeStdout(`${JSON.stringify(getTtyDiagnostics(), null, 2)}
`);
}

function getClackIo() {
  return {
    input: process.stdin,
    output: process.stdout,
  };
}

function assertClackTtyReady(options: InstallOptions): void {
  if (options.yes || options.json || options.checkTty) return;

  const diagnostics = getTtyDiagnostics();
  if (
    diagnostics.stdinIsTTY &&
    diagnostics.stdoutIsTTY &&
    diagnostics.stderrIsTTY &&
    diagnostics.canSetRawMode
  ) {
    return;
  }

  throw new Error(
    [
      'interactive Consuelo OS setup needs a real terminal for keyboard input.',
      `stdin.isTTY=${diagnostics.stdinIsTTY}`,
      `stdout.isTTY=${diagnostics.stdoutIsTTY}`,
      `stderr.isTTY=${diagnostics.stderrIsTTY}`,
      `canSetRawMode=${diagnostics.canSetRawMode}`,
      'Re-run non-interactively with: curl -fsSL https://install.consuelohq.com/os | bash -s -- --yes --install-daemons',
    ].join('\n'),
  );
}

function summarizeActions(result: ReturnType<typeof provisionLocalOs>): string {
  return `saved to ${result.home}`;
}


export type PendingWorkspaceSelection = {
  deviceCode: string;
  intervalSeconds: number;
  deviceKeyPair: WorkspaceDeviceKeyPair;
};

export type DeviceLoginAttemptResult = {
  status: 'approved' | 'fallback' | 'skipped' | 'workspace_required';
  verificationUrl?: string;
  workspaceBootstrap?: WorkspaceBootstrap;
  workspaceSelection?: PendingWorkspaceSelection;
};

export type ResolvedWorkspaceIdentity = {
  workspaceName: string;
  workspaceSlug: string;
  workspaceHost: string;
  workspaceBootstrap?: WorkspaceBootstrap;
};

function workspaceBootstrapFromApprovedDeviceGrant(input: {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId?: string;
  nodeName?: string;
  nodeRole?: 'home' | 'member';
  nodeStatus?: 'created' | 'reconnected';
  connectorId: string;
  connectorBootstrapToken: string;
  cloudflareTunnelToken?: string;
}): WorkspaceBootstrap {
  const connectorTransport = input.cloudflareTunnelToken
    ? 'cloudflare-tunnel'
    : 'websocket-relay';

  return {
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    workspaceHost: input.workspaceHost,
    ...(input.nodeId ? { nodeId: input.nodeId } : {}),
    ...(input.nodeName ? { nodeName: input.nodeName } : {}),
    ...(input.nodeRole ? { nodeRole: input.nodeRole } : {}),
    ...(input.nodeStatus ? { nodeStatus: input.nodeStatus } : {}),
    connectorId: input.connectorId,
    connectorTransport,
    connectorBootstrapToken: input.connectorBootstrapToken,
    ...(input.cloudflareTunnelToken
      ? { cloudflareTunnelToken: input.cloudflareTunnelToken }
      : {}),
  };
}

function createInstallPlatformProvisioningPayload(input: {
  dryRun: boolean;
  workspaceBootstrap?: WorkspaceBootstrap;
  approvedWorkspaceBootstrap?: WorkspaceBootstrap;
}): InstallPlatformProvisioningPayload {
  if (input.dryRun) {
    return {
      status: 'planned',
      workspaceHost: input.workspaceBootstrap?.workspaceHost,
      message: 'Consuelo platform provisioning is handled by the approval control plane',
    };
  }

  if (input.approvedWorkspaceBootstrap) {
    return {
      status: 'managed',
      workspaceId: input.approvedWorkspaceBootstrap.workspaceId,
      workspaceSlug: input.approvedWorkspaceBootstrap.workspaceSlug,
      workspaceHost: input.approvedWorkspaceBootstrap.workspaceHost,
      message: 'Consuelo platform provisioning completed before scoped bootstrap was issued',
    };
  }

  return {
    status: 'skipped',
    workspaceHost: input.workspaceBootstrap?.workspaceHost,
    message: 'workspace platform provisioning skipped: approved device login not available',
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function withRuntimeHold<T>(operation: () => Promise<T>): Promise<T> {
  const hold = setInterval(() => undefined, 1000);
  try {
    return await operation();
  } finally {
    clearInterval(hold);
  }
}

async function openDeviceVerificationUrl(url: string): Promise<boolean> {
  if (process.platform !== 'darwin') return false;

  try {
    const proc = Bun.spawn(['open', url], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}


async function copyDeviceVerificationUrl(url: string): Promise<boolean> {
  if (process.platform !== 'darwin') return false;

  try {
    const proc = Bun.spawn(['pbcopy'], {
      stdin: 'pipe',
      stdout: 'ignore',
      stderr: 'ignore',
    });
    proc.stdin.write(url);
    proc.stdin.end();
    const exitCode = await proc.exited;

    return exitCode === 0;
  } catch {
    return false;
  }
}

function sanitizeTerminalOutput(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, '');
}

function terminalLink(label: string, url: string): string {
  return `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007`;
}

async function printDeviceLoginPrompt(input: {
  userCode: string;
  verificationUrl: string;
}): Promise<void> {
  const sanitizedVerificationUrl = sanitizeTerminalOutput(input.verificationUrl);

  try {
    const copied = await copyDeviceVerificationUrl(sanitizedVerificationUrl);
    const formattedCode = input.userCode.replace(/[^a-z0-9]/gi, '').toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
    const openLink = terminalLink('click here', sanitizedVerificationUrl);
    const copyState = copied ? 'Auth URL copied to clipboard.' : 'Copying not available; use the full URL below.';

    note(
      [
        'Approve in your browser to finish signing in.',
        '',
        `    ${formattedCode}`,
        '',
        'Make sure your browser shows this code.',
        copyState,
        `Open link: ${openLink}`,
        `Full URL: ${sanitizedVerificationUrl}`,
      ].join('\n'),
      'Consuelo OS',
    );
  } catch (error: unknown) {
    const reason = formatUnknownError(error);

    info(`authorize Consuelo OS in your browser: ${sanitizedVerificationUrl}`);
    info(`device login prompt fell back to plain URL: ${reason}`);
  }
}

type DeviceLoginDependencies = {
  readLocalNodeIdentity: typeof readLocalNodeIdentity;
  requestWorkspaceDeviceCode: typeof requestWorkspaceDeviceCode;
  pollWorkspaceDeviceAccessToken: typeof pollWorkspaceDeviceAccessToken;
  printDeviceLoginPrompt: typeof printDeviceLoginPrompt;
  openDeviceVerificationUrl: typeof openDeviceVerificationUrl;
  sleep: (ms: number) => Promise<void>;
  withRuntimeHold: typeof withRuntimeHold;
};

const DEFAULT_DEVICE_LOGIN_DEPENDENCIES: DeviceLoginDependencies = {
  readLocalNodeIdentity,
  requestWorkspaceDeviceCode,
  pollWorkspaceDeviceAccessToken,
  printDeviceLoginPrompt,
  openDeviceVerificationUrl,
  sleep,
  withRuntimeHold,
};

type WorkspaceDeviceSelectionDependencies = {
  selectWorkspaceForDeviceLogin: typeof selectWorkspaceForDeviceLogin;
  withRuntimeHold: typeof withRuntimeHold;
};

const DEFAULT_WORKSPACE_DEVICE_SELECTION_DEPENDENCIES: WorkspaceDeviceSelectionDependencies = {
  selectWorkspaceForDeviceLogin,
  withRuntimeHold,
};

export async function completeWorkspaceDeviceSelection(
  input: {
    diagnostics: InstallDiagnostics;
    selection: PendingWorkspaceSelection;
    workspaceName: string;
    workspaceSlug: string;
    workspaceHost: string;
  },
  dependencies: WorkspaceDeviceSelectionDependencies = DEFAULT_WORKSPACE_DEVICE_SELECTION_DEPENDENCIES,
): Promise<ResolvedWorkspaceIdentity> {
  const { diagnostics, selection, workspaceName, workspaceSlug, workspaceHost } = input;

  recordInstallerStep(diagnostics, 'workspace_selection', 'start', {
    workspaceHost,
    workspaceSlug,
  });

  let selected: Awaited<ReturnType<typeof selectWorkspaceForDeviceLogin>>;
  let failureRecorded = false;
  try {
    recordInstallerStep(diagnostics, 'workspace_selection', 'request', {
      workspaceHost,
      workspaceSlug,
    });
    selected = await dependencies.withRuntimeHold(async () => {
      try {
        return await dependencies.selectWorkspaceForDeviceLogin({
          clientId: DEVICE_LOGIN_CLIENT_ID,
          deviceCode: selection.deviceCode,
          intervalSeconds: selection.intervalSeconds,
          deviceKeyPair: selection.deviceKeyPair,
          workspaceName,
          workspaceSlug,
          workspaceHost,
        });
      } catch (error: unknown) {
        failureRecorded = true;
        const message = formatUnknownError(error);
        diagnostics.recordHttp('device.workspace_selection', 0, 'exception');
        recordInstallerStep(diagnostics, 'workspace_selection', 'failed', { error: message });
        throw error;
      }
    });
  } catch (error: unknown) {
    if (failureRecorded) throw error;
    const message = formatUnknownError(error);
    diagnostics.recordHttp('device.workspace_selection', 0, 'exception');
    recordInstallerStep(diagnostics, 'workspace_selection', 'failed', { error: message });
    throw error;
  }

  const selectedStatusCode = selected.status === 'approved' ? 200 : 400;
  diagnostics.recordHttp('device.workspace_selection', selectedStatusCode, selected.status);

  if (selected.status === 'approved') {
    recordInstallerStep(diagnostics, 'workspace_selection', 'complete', {
      workspaceHost: selected.workspaceHost,
      workspaceSlug: selected.workspaceSlug,
      nodeStatus: selected.nodeStatus,
      nodeRole: selected.nodeRole,
    });
    return {
      workspaceName,
      workspaceSlug: selected.workspaceSlug,
      workspaceHost: selected.workspaceHost,
      workspaceBootstrap: workspaceBootstrapFromApprovedDeviceGrant(selected),
    };
  }

  const failureDetails: Record<string, unknown> = { status: selected.status };
  if ('message' in selected) failureDetails.message = selected.message;
  if ('errorCode' in selected) failureDetails.errorCode = selected.errorCode;
  recordInstallerStep(diagnostics, 'workspace_selection', 'failed', failureDetails);
  throw new Error(
    'message' in selected && selected.message
      ? `workspace selection failed: ${selected.status}: ${selected.message}`
      : `workspace selection failed: ${selected.status}`,
  );
}

export async function attemptWorkspaceDeviceLogin(
  input: {
    dryRun: boolean;
    home: string;
    diagnostics: InstallDiagnostics;
  },
  dependencies: DeviceLoginDependencies = DEFAULT_DEVICE_LOGIN_DEPENDENCIES,
): Promise<DeviceLoginAttemptResult> {
  recordInstallerStep(input.diagnostics, 'device_login', 'start');
  if (input.dryRun) {
    recordInstallerStep(input.diagnostics, 'device_login', 'skipped', { status: 'skipped' });
    return { status: 'skipped' };
  }

  try {
    const localNodeIdentity = dependencies.readLocalNodeIdentity(input.home);
    const liveDeviceCode = await dependencies.requestWorkspaceDeviceCode({
      clientId: DEVICE_LOGIN_CLIENT_ID,
      scope: DEVICE_LOGIN_SCOPE,
      nodeId: localNodeIdentity?.nodeId,
      nodeName: localNodeIdentity?.nodeName,
    });
    if (liveDeviceCode.status !== 'started') {
      input.diagnostics.recordHttp('device.code', 503, liveDeviceCode.status);
      recordInstallerStep(input.diagnostics, 'device_login', 'complete', { status: 'fallback' });
      info('Device login unavailable; continuing with local workspace bootstrap.');
      return { status: 'fallback' };
    }
    input.diagnostics.recordHttp('device.code', 200, liveDeviceCode.status);

    const session = liveDeviceCode.session;
    await dependencies.printDeviceLoginPrompt({
      userCode: session.userCode,
      verificationUrl: session.verificationUriComplete,
    });
    recordInstallerStep(input.diagnostics, 'device_login', 'prompt_displayed', { displayed: true });
    const browserOpened = await dependencies.openDeviceVerificationUrl(session.verificationUriComplete);
    recordInstallerStep(input.diagnostics, 'device_login', 'browser_open', { opened: browserOpened });

    const deadlineMs = Date.now() + DEVICE_LOGIN_POLL_TIMEOUT_MS;
    let intervalSeconds = session.intervalSeconds;

    while (Date.now() < deadlineMs) {
      recordInstallerStep(input.diagnostics, 'device_login', 'poll_wait', { intervalSeconds });
      const pollResult = await dependencies.withRuntimeHold(async () => {
        try {
          await dependencies.sleep(Math.min(intervalSeconds, 5) * 1000);
          recordInstallerStep(input.diagnostics, 'device_login', 'poll_request', { intervalSeconds });
          return await dependencies.pollWorkspaceDeviceAccessToken({
            clientId: DEVICE_LOGIN_CLIENT_ID,
            deviceCode: liveDeviceCode.session.deviceCode,
            intervalSeconds,
            deviceKeyPair: liveDeviceCode.deviceKeyPair,
          });
        } catch (error: unknown) {
          recordInstallerStep(input.diagnostics, 'device_login', 'poll_failed', {
            error: formatUnknownError(error),
          });
          throw error;
        }
      });

      const pollDetails: Record<string, unknown> = {
        status: pollResult.status,
        intervalSeconds: 'intervalSeconds' in pollResult ? pollResult.intervalSeconds : intervalSeconds,
      };
      if ('message' in pollResult) pollDetails.message = pollResult.message;
      if ('errorCode' in pollResult) pollDetails.errorCode = pollResult.errorCode;
      recordInstallerStep(input.diagnostics, 'device_login', 'poll_result', pollDetails);

      if (pollResult.status === 'approved') {
        input.diagnostics.recordHttp('device.poll', 200, pollResult.status);
        recordInstallerStep(input.diagnostics, 'device_login', 'complete', { status: pollResult.status });
        info('Consuelo OS authorization approved.');
        return {
          status: 'approved',
          verificationUrl: session.verificationUriComplete,
          workspaceBootstrap: workspaceBootstrapFromApprovedDeviceGrant(pollResult),
        };
      }

      if (pollResult.status === 'workspace_required') {
        input.diagnostics.recordHttp('device.poll', 400, pollResult.status);
        const details: Record<string, unknown> = { status: pollResult.status };
        if ('message' in pollResult) details.message = pollResult.message;
        recordInstallerStep(input.diagnostics, 'device_login', 'complete', details);
        info('Consuelo OS authorization approved. Workspace name required to finish setup.');
        return {
          status: 'workspace_required',
          verificationUrl: session.verificationUriComplete,
          workspaceSelection: {
            deviceCode: liveDeviceCode.session.deviceCode,
            intervalSeconds: pollResult.intervalSeconds,
            deviceKeyPair: liveDeviceCode.deviceKeyPair,
          },
        };
      }

      if (pollResult.status === 'pending' || pollResult.status === 'slow_down') {
        input.diagnostics.recordHttp('device.poll', 400, pollResult.status);
        intervalSeconds = pollResult.intervalSeconds;
        continue;
      }

      input.diagnostics.recordHttp('device.poll', 400, pollResult.status);
      const details: Record<string, unknown> = { status: 'fallback', pollStatus: pollResult.status };
      if ('message' in pollResult) details.message = pollResult.message;
      if ('errorCode' in pollResult) details.errorCode = pollResult.errorCode;
      recordInstallerStep(input.diagnostics, 'device_login', 'complete', details);
      info('Device login unavailable; continuing with local workspace bootstrap.');
      return { status: 'fallback', verificationUrl: session.verificationUriComplete };
    }

    recordInstallerStep(input.diagnostics, 'device_login', 'complete', { status: 'fallback', reason: 'timeout' });
    info('Device login was not approved before timeout; continuing with local workspace bootstrap.');
    return { status: 'fallback', verificationUrl: session.verificationUriComplete };
  } catch (error: unknown) {
    const message = formatUnknownError(error);
    recordInstallerStep(input.diagnostics, 'device_login', 'failed', { error: message });
    info('Device login unavailable; continuing with local workspace bootstrap.');
    return { status: 'fallback' };
  }
}

async function resolveWorkspaceIdentity(input: {
  options: InstallOptions;
  clackIo: ReturnType<typeof getClackIo>;
  deviceLogin: DeviceLoginAttemptResult;
  diagnostics: InstallDiagnostics;
}): Promise<ResolvedWorkspaceIdentity> {
  const approvedBootstrap = input.deviceLogin.workspaceBootstrap;
  if (approvedBootstrap) {
    return {
      workspaceName: approvedBootstrap.workspaceSlug,
      workspaceSlug: approvedBootstrap.workspaceSlug,
      workspaceHost: approvedBootstrap.workspaceHost,
      workspaceBootstrap: approvedBootstrap,
    };
  }

  const workspaceNameInput = await text({
    ...input.clackIo,
    message: 'enter workspace name',
    initialValue: input.options.workspaceName ?? input.options.workspaceSlug ?? '',
    validate: (value) => {
      try {
        normalizeWorkspaceName(value);
        return undefined;
      } catch (error: unknown) {
        return formatUnknownError(error);
      }
    },
  });
  if (isCancel(workspaceNameInput)) { cancel('setup cancelled.'); process.exit(0); }

  const rawWorkspaceName = String(workspaceNameInput);
  recordPromptDecision(input.diagnostics, 'workspace.name', rawWorkspaceName);
  const workspaceName = normalizeWorkspaceName(rawWorkspaceName);
  const workspaceSlug = workspaceName;
  const workspaceHost = workspaceHostFromSlug(workspaceSlug);

  if (input.deviceLogin.status !== 'workspace_required') {
    return { workspaceName, workspaceSlug, workspaceHost };
  }

  const selection = input.deviceLogin.workspaceSelection;
  if (!selection) {
    throw new Error('device login requested workspace selection without a device session');
  }

  return completeWorkspaceDeviceSelection({
    diagnostics: input.diagnostics,
    selection,
    workspaceName,
    workspaceSlug,
    workspaceHost,
  });
}
async function promptOptions(
  options: InstallOptions,
  diagnostics: InstallDiagnostics,
): Promise<InstallOptions> {
  try {
    if (options.yes || options.json) return options;
    assertClackTtyReady(options);

    recordInstallerStep(diagnostics, 'workspace', 'start');
    renderInstallerProgress('workspace');
    info('finish workspace identity, security, skills, agents, service, and health.');
    const clackIo = getClackIo();

    let mode: OsMode = options.mode ?? 'local';
    if (!options.mode) {
      const selectedMode = await select({
        ...clackIo,
        message: 'choose an OS mode',
        initialValue: 'local',
        options: [
          { value: 'local' as const, label: 'local' },
          { value: 'cloud' as const, label: 'cloud' },
        ],
      });
      if (isCancel(selectedMode)) { cancel('setup cancelled.'); process.exit(0); }
      mode = selectedMode;
      recordPromptDecision(diagnostics, 'os.mode', mode);
    }

    if (mode === 'cloud') {
      info('Cloud setup is handled by Consuelo. Open https://consuelohq.com/contact/ to get started.');
      process.exit(0);
    }

    recordInstallerStep(diagnostics, 'workspace', 'complete', { mode });
    recordInstallerStep(diagnostics, 'security', 'start');
    const home = resolveOsHome(options.home);

    renderInstallerProgress('security');
    const deviceLogin = await attemptWorkspaceDeviceLogin({
      dryRun: options.dryRun,
      home,
      diagnostics,
    });
    const workspaceIdentity = await resolveWorkspaceIdentity({
      options,
      clackIo,
      deviceLogin,
      diagnostics,
    });
    const { workspaceName, workspaceSlug, workspaceHost } = workspaceIdentity;
    recordInstallerStep(diagnostics, 'security', 'complete', {
      deviceLoginStatus: deviceLogin.status,
      workspaceHost,
      workspaceSlug,
    });

    recordInstallerStep(diagnostics, 'skills', 'start');
    renderInstallerProgress('skills');
    const skillPrompt = getGroupedOnboardingSkillOptions();
    const selectedSkills = await groupMultiselect({
      ...clackIo,
      message: 'select skills to enable — Use Space to select skills, press Enter to continue',
      options: skillPrompt.options,
      initialValues: skillPrompt.initialValues,
      cursorAt: skillPrompt.cursorAt,
      selectableGroups: skillPrompt.selectableGroups,
      groupSpacing: skillPrompt.groupSpacing,
      required: false,
    });
    if (isCancel(selectedSkills)) { cancel('setup cancelled.'); process.exit(0); }
    recordPromptDecision(diagnostics, 'skills.selected', selectedSkills);
    recordInstallerStep(diagnostics, 'skills', 'complete', {
      selectedCount: Array.isArray(selectedSkills) ? selectedSkills.length : 0,
    });

    const artifactMode = options.artifactMode;

    recordInstallerStep(diagnostics, 'agents', 'start');
    renderInstallerProgress('agents');
    const detectedAgents = detectAgents(home).filter((agent) => agent.detected);
    let connectAgents: AgentName[] = options.connectAgents;
    if (detectedAgents.length > 0) {
      const selectedAgents = await multiselect({
        ...clackIo,
        message: formatLocalAgentsPromptMessage(detectedAgents.length),
        options: detectedAgents.map((agent) => ({ value: agent.name, label: agent.label, hint: agent.homePath })),
        initialValues: options.connectAgents.length > 0
          ? options.connectAgents
          : detectedAgents.map((agent) => agent.name),
        required: false,
      });
      if (isCancel(selectedAgents)) { cancel('setup cancelled.'); process.exit(0); }
      connectAgents = selectedAgents as AgentName[];
      recordPromptDecision(diagnostics, 'agents.connected', connectAgents);
    }
    recordInstallerStep(diagnostics, 'agents', 'complete', {
      detectedCount: detectedAgents.length,
      connectedCount: connectAgents.length,
    });

    recordInstallerStep(diagnostics, 'service', 'start');
    renderInstallerProgress('service');
    let installDaemons = false;
    if (options.installDaemons) {
      installDaemons = true;
    } else if (options.skipDaemons) {
      installDaemons = false;
    } else {
      const selectedInstallDaemons = await select({
        ...clackIo,
        message: 'install local background service?',
        initialValue: 'yes',
        options: [
          { value: 'yes' as const, label: 'Yes' },
          { value: 'no' as const, label: 'No' },
        ],
      });
      if (isCancel(selectedInstallDaemons)) { cancel('setup cancelled.'); process.exit(0); }
      installDaemons = selectedInstallDaemons === 'yes';
      recordPromptDecision(diagnostics, 'service.install_daemons', selectedInstallDaemons);
    }
    recordInstallerStep(diagnostics, 'service', 'complete', { installDaemons });
    recordInstallerStep(diagnostics, 'health', 'start');
    renderInstallerProgress('health');
    return {
      ...options,
      mode,
      home,
      workspaceName,
      workspaceHost,
      workspaceSlug,
      workspaceBootstrap: workspaceIdentity.workspaceBootstrap,
      deviceLoginStatus: deviceLogin.status,
      deviceLoginUrl: deviceLogin.verificationUrl,
      selectedSkills: selectedSkills as SkillName[],
      artifactMode,
      connectAgents,
      installDaemons,
    };
  } catch (error: unknown) {
    throw new Error(`install prompt failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  let diagnostics: InstallDiagnostics | null = null;
  try {
    const parsedOptions = parseArgs(process.argv.slice(2));
    diagnostics = createInstallDiagnostics({
      home: resolveOsHome(parsedOptions.home),
      argv: process.argv.slice(2),
    });
    registerInstallerDiagnosticsLifecycleHooks(diagnostics);
    recordInstallerStep(diagnostics, 'dependencies', 'complete');
    if (parsedOptions.checkTty) {
      printTtyDiagnostics();
      return;
    }

    const options = await promptOptions(parsedOptions, diagnostics);
    const spin =
      options.quiet || options.json
        ? null
        : spinner(
            options.dryRun
              ? 'planning local OS install...'
              : 'installing local OS...',
          ).start();
    const workspaceBootstrap = maybeCreateWorkspaceBootstrap(options);
    const result = provisionLocalOs({
      home: options.home,
      mode: options.mode ?? 'local',
      port: resolveLocalOsPortOverride(),
      dryRun: options.dryRun,
      connectAgents: options.connectAgents,
      selectedSkills: options.selectedSkills,
      artifactStorage: options.artifactMode,
      workspaceBootstrap,
    });
    const platformProvisioning = createInstallPlatformProvisioningPayload({
      dryRun: options.dryRun,
      workspaceBootstrap,
      approvedWorkspaceBootstrap: options.workspaceBootstrap,
    });
    const installDaemons = options.installDaemons;
    const payload = {
      ...result,
      platformProvisioning,
      onboarding: {
        selectedSkills: options.selectedSkills,
        artifactMode: options.artifactMode,
        workspaceName: options.workspaceName,
        workspaceHost: options.workspaceHost,
        workspaceSlug: options.workspaceSlug,
        deviceLoginStatus: options.deviceLoginStatus,
        deviceLoginUrl: options.deviceLoginUrl,
        connectAgents: options.connectAgents,
        installDaemons: installDaemons,
      },
      installDaemons: installDaemons,
    };
    const resultFile = process.env.CONSUELO_ONBOARDING_RESULT_FILE;
    const suppressFinalSummary = Boolean(resultFile);
    if (resultFile) {
      fs.writeFileSync(resultFile, `${JSON.stringify(payload, null, 2)}\n`, {
        mode: 0o600,
      });
    }

    recordInstallerStep(diagnostics, 'health', 'complete', { home: result.home });
    diagnostics.finish({
      status: 'ok',
      home: result.home,
      installDaemons: installDaemons,
      workspaceHost: options.workspaceHost,
      workspaceSlug: options.workspaceSlug,
    });

    spin?.succeed(options.dryRun ? 'install plan ready' : 'local OS saved');

    if (!options.quiet && !options.json) {
      renderInstallerProgress(null);
    }

    if (options.json) {
      writeStdout(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    if (!options.quiet) {
      success(options.dryRun ? 'dry run complete' : 'configuration saved');
      if (!suppressFinalSummary) {
        info(summarizeActions(result));
        info(
          `next: CONSUELO_HOME=${result.home} bun run --cwd ${result.home} doctor`,
        );
        printEnd('OS ready');
      }
    }
  } catch (error: unknown) {
    const message = formatUnknownError(error);
    diagnostics?.finish({ status: 'error', error: message });
    throw new Error(`install failed: ${message}`);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}

