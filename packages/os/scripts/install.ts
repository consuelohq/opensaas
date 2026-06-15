#!/usr/bin/env bun

import fs from 'node:fs';
import {
  cancel,
  confirm,
  groupMultiselect,
  isCancel,
  multiselect,
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
} from './lib/cli-ui';
import {
  detectAgents,
  provisionLocalOs,
  resolveOsHome,
  type AgentName,
  type OsMode,
  type WorkspaceBootstrap,
} from './lib/install-state';
import {
  pollWorkspaceDeviceAccessToken,
  requestWorkspaceDeviceCode,
} from './lib/workspace-device-login-client';
type ArtifactMode = 'local';
type SkillName = string;

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
  deviceLoginStatus?: 'approved' | 'fallback' | 'skipped';
  deviceLoginUrl?: string;
  artifactMode: ArtifactMode;
  selectedSkills: SkillName[];
  connectAgents: AgentName[];
};

const AGENT_NAMES = new Set<AgentName>([
  'codex',
  'claude',
  'opencode',
  'factory',
]);

function writeStdout(value: string): void {
  process.stdout.write(value);
}

const WORKSPACE_BASE_DOMAIN = 'consuelohq.com';
const DEVICE_LOGIN_CLIENT_ID = 'consuelo-os-installer';
const DEVICE_LOGIN_SCOPE = ['workspace:read', 'os:connector:register'];
const DEVICE_LOGIN_POLL_TIMEOUT_MS = 45_000;

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
          '--connect-agent must be codex, claude, opencode, or factory',
        );
      options.connectAgents.push(agent);
    } else if (arg === '--connect-agents') {
      options.connectAgents = ['codex', 'claude', 'opencode'];
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
          '  --connect-agent <id>  connect codex, claude, opencode, or factory',
          '  --connect-agents      connect detected Codex, Claude, and OpenCode agents',
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


type DeviceLoginAttemptResult = {
  status: 'approved' | 'fallback' | 'skipped';
  verificationUrl?: string;
  workspaceBootstrap?: WorkspaceBootstrap;
};

function workspaceBootstrapFromApprovedDeviceGrant(input: {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  connectorId: string;
  connectorBootstrapToken: string;
}): WorkspaceBootstrap {
  return {
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    workspaceHost: input.workspaceHost,
    connectorId: input.connectorId,
    connectorTransport: 'websocket-relay',
    connectorBootstrapToken: input.connectorBootstrapToken,
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

async function attemptWorkspaceDeviceLogin(input: {
  workspaceName: string;
  workspaceSlug: string;
  workspaceHost: string;
  dryRun: boolean;
}): Promise<DeviceLoginAttemptResult> {
  if (input.dryRun) return { status: 'skipped' };

  try {
    const liveDeviceCode = await requestWorkspaceDeviceCode({
      clientId: DEVICE_LOGIN_CLIENT_ID,
      scope: DEVICE_LOGIN_SCOPE,
      workspaceName: input.workspaceName,
      workspaceSlug: input.workspaceSlug,
      workspaceHost: input.workspaceHost,
    });
    if (liveDeviceCode.status !== 'started') {
      info('Device login unavailable; continuing with local workspace bootstrap.');
      return { status: 'fallback' };
    }

    const session = liveDeviceCode.session;
    info(`authorize Consuelo OS in your browser: ${session.verificationUriComplete}`);
    await openDeviceVerificationUrl(session.verificationUriComplete);

    const deadlineMs = Date.now() + DEVICE_LOGIN_POLL_TIMEOUT_MS;
    let intervalSeconds = session.intervalSeconds;

    while (Date.now() < deadlineMs) {
      await sleep(Math.min(intervalSeconds, 5) * 1000);
      const pollResult = await pollWorkspaceDeviceAccessToken({
        clientId: DEVICE_LOGIN_CLIENT_ID,
        deviceCode: liveDeviceCode.session.deviceCode,
        intervalSeconds,
        deviceKeyPair: liveDeviceCode.deviceKeyPair,
      });

      if (pollResult.status === 'approved') {
        info('Consuelo OS authorization approved.');
        return {
          status: 'approved',
          verificationUrl: session.verificationUriComplete,
          workspaceBootstrap: workspaceBootstrapFromApprovedDeviceGrant(pollResult),
        };
      }

      if (pollResult.status === 'pending' || pollResult.status === 'slow_down') {
        intervalSeconds = pollResult.intervalSeconds;
        continue;
      }

      info('Device login unavailable; continuing with local workspace bootstrap.');
      return { status: 'fallback', verificationUrl: session.verificationUriComplete };
    }

    info('Device login was not approved before timeout; continuing with local workspace bootstrap.');
    return { status: 'fallback', verificationUrl: session.verificationUriComplete };
  } catch {
    info('Device login unavailable; continuing with local workspace bootstrap.');
    return { status: 'fallback' };
  }
}

async function promptOptions(options: InstallOptions): Promise<InstallOptions> {
  try {
    if (options.yes || options.json) return options;
    assertClackTtyReady(options);

    printOsBanner(['workspace', 'home', 'skills', 'artifacts', 'agents', 'health']);
    info('finish workspace identity, home, skills, artifacts, agents, and health before the final background service step.');
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
    }

    if (mode === 'cloud') {
      info('Cloud setup is handled by Consuelo. Open https://consuelohq.com/contact/ to get started.');
      process.exit(0);
    }

    const workspaceNameInput = await text({
      ...clackIo,
      message: 'enter workspace name',
      initialValue: options.workspaceName ?? options.workspaceSlug ?? '',
      validate: (value) => {
        try {
          normalizeWorkspaceName(value);
          return undefined;
        } catch (error: unknown) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    });
    if (isCancel(workspaceNameInput)) { cancel('setup cancelled.'); process.exit(0); }
    const workspaceName = normalizeWorkspaceName(workspaceNameInput);
    const workspaceSlug = workspaceName;
    const workspaceHost = workspaceHostFromSlug(workspaceSlug);
    const deviceLogin = await attemptWorkspaceDeviceLogin({
      workspaceName,
      workspaceSlug,
      workspaceHost,
      dryRun: options.dryRun,
    });

    const home = await text({
      ...clackIo,
      message: 'OS home',
      initialValue: resolveOsHome(options.home),
      validate: (value) => (value.length > 0 ? undefined : 'home is required'),
    });
    if (isCancel(home)) { cancel('setup cancelled.'); process.exit(0); }

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

    const artifactMode = options.artifactMode;

    const detectedAgents = detectAgents(home).filter((agent) => agent.detected);
    let connectAgents: AgentName[] = options.connectAgents;
    if (detectedAgents.length > 0) {
      const shouldConnect = await confirm({ ...clackIo, message: 'connect detected agents to the OS portal?', initialValue: true });
      if (!isCancel(shouldConnect) && shouldConnect) {
        const selectedAgents = await multiselect({
          ...clackIo,
          message: 'select agents to connect — Use Space to select agents, press Enter to continue',
          options: detectedAgents.map((agent) => ({ value: agent.name, label: agent.label, hint: agent.homePath })),
          required: false,
        });
        if (!isCancel(selectedAgents)) connectAgents = selectedAgents as AgentName[];
      }
    }

    const installDaemons = await confirm({ ...clackIo, message: 'install local background service?', initialValue: true });
    if (isCancel(installDaemons)) { cancel('setup cancelled.'); process.exit(0); }
    info('background service is the final setup step; tokens and secrets stay local and are not printed.');

    return {
      ...options,
      mode,
      home,
      workspaceName,
      workspaceHost,
      workspaceSlug,
      workspaceBootstrap: deviceLogin.workspaceBootstrap,
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
  try {
    const parsedOptions = parseArgs(process.argv.slice(2));
    if (parsedOptions.checkTty) {
      printTtyDiagnostics();
      return;
    }

    const options = await promptOptions(parsedOptions);
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
      dryRun: options.dryRun,
      connectAgents: options.connectAgents,
      selectedSkills: options.selectedSkills,
      artifactStorage: options.artifactMode,
      workspaceBootstrap,
    });
    const payload = {
      ...result,
      onboarding: {
        selectedSkills: options.selectedSkills,
        artifactMode: options.artifactMode,
        workspaceName: options.workspaceName,
        workspaceHost: options.workspaceHost,
        workspaceSlug: options.workspaceSlug,
        deviceLoginStatus: options.deviceLoginStatus,
        deviceLoginUrl: options.deviceLoginUrl,
        connectAgents: options.connectAgents,
        installDaemons: options.installDaemons,
      },
      installDaemons: options.installDaemons,
    };
    const resultFile = process.env.CONSUELO_ONBOARDING_RESULT_FILE;
    const suppressFinalSummary = Boolean(resultFile);
    if (resultFile) {
      fs.writeFileSync(resultFile, `${JSON.stringify(payload, null, 2)}\n`, {
        mode: 0o600,
      });
    }

    spin?.succeed(options.dryRun ? 'install plan ready' : 'local OS saved');

    if (options.json) {
      writeStdout(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    if (!options.quiet) {
      success(options.dryRun ? 'dry run complete' : 'configuration saved');
      info(summarizeActions(result));
      if (!suppressFinalSummary) {
        info(
          `next: CONSUELO_HOME=${result.home} bun --cwd ${result.home} run doctor`,
        );
        printEnd('OS ready');
      }
    }
  } catch (error: unknown) {
    throw new Error(
      `install failed: ${error instanceof Error ? error.message : String(error)}`,
    );
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

