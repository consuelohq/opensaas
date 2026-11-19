import { createHash, randomUUID } from 'node:crypto';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';
import type { z } from 'zod';

import { createNodeProviderProcess } from '../../tools/deployment-provider/process';
import type { ProviderProcessResult } from '../../tools/deployment-provider/types';
import { resolveOsHome } from './install-state';
import { NodeResourceLockError, withNodeResourceLock, nodeResourceLockPath } from './node-resource-lock';
import { ComputerUseInput } from './facade/schemas';
import type { ErrorCode } from './facade/types';

type Input = z.infer<typeof ComputerUseInput>;
type Host = { home: string; platform: NodeJS.Platform; arch: string; diaInstalled: boolean; systemChromium?: string };
type Command = {
  command: string;
  args: string[];
  stdin?: string;
  setupArgs?: string[];
  profile?: string;
  browser?: 'dia' | 'chromium';
  screenshot?: string;
  chromiumInstallArgs?: string[];
};
type Outcome = { ok: boolean; code: ErrorCode; message: string; data: unknown };

const requirePackage = createRequire(import.meta.url);

function providerExecutable(command: string, env: NodeJS.ProcessEnv): string {
  if (command === 'agent-browser') {
    const root = dirname(requirePackage.resolve('agent-browser/package.json'));
    const { nativeTarget, findNativeBinary } = requirePackage('agent-browser/scripts/native.js');
    const target = nativeTarget();
    const binary = target && findNativeBinary(root, target);
    if (!binary) throw new BrowserUnavailableError('The native Agent Browser binary is unavailable. Reinstall Consuelo OS with optional dependencies for this platform.');
    return binary;
  }
  const root = dirname(requirePackage.resolve('agent-desktop/package.json'));
  const { resolve } = requirePackage('agent-desktop/lib/platform.js');
  const target = resolve(process.platform, process.arch);
  if (!target) throw new Error('Agent Desktop does not support this platform');
  if (process.platform === 'darwin') env.AGENT_DESKTOP_MACOS_HELPER_PATH = join(root, 'bin', 'agent-desktop-macos-helper-darwin-' + process.arch);
  return join(root, 'bin', target.binaryName);
}

class BrowserUnavailableError extends Error {}

function linuxArm64Chromium(): string | undefined {
  // Chrome for Testing does not publish Linux ARM64 builds.
  return ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/lib/chromium/chromium'].find(path => {
    try {
      accessSync(path, constants.X_OK);
      return statSync(path).isFile();
    } catch {
      return false;
    }
  });
}

const diaExecutable = '/Applications/Dia.app/Contents/MacOS/Dia';
const launcher = fileURLToPath(new URL('../dia-launcher.sh', import.meta.url));
const browserConfig = fileURLToPath(new URL('../computer-browser.json', import.meta.url));
const desktopRef = /^@[A-Za-z0-9_-]+:e[0-9]+$/;
const browserRef = /^@e[0-9]+$/;

function required(value: string | undefined, field: string): string {
  if (value === undefined) throw new Error(field + ' is required for this action');
  return value;
}

function element(input: Input, pattern: RegExp): string {
  if (!input.ref || !pattern.test(input.ref)) throw new Error('Use a ref from a fresh snapshot of this target');
  return input.ref;
}

function desktopCommand(input: Input, screenshot?: string): Command {
  const app = () => ['--app', required(input.app, 'app'), ...(input.windowId ? ['--window-id', input.windowId] : [])];
  const args = input.headed ? ['--headed'] : [];
  let stdin: string | undefined;
  switch (input.action) {
    case 'status': args.push('status'); break;
    case 'apps': args.push('list-apps'); break;
    case 'windows': args.push('list-windows', ...(input.app ? ['--app', input.app] : [])); break;
    case 'launch': args.push('launch', required(input.app, 'app'), ...(input.headed ? ['--activate'] : [])); break;
    case 'snapshot': args.push('snapshot', ...app(), '--compact', '-i', '--surface', input.surface ?? 'window'); break;
    case 'screenshot': args.push('screenshot', ...app(), required(screenshot, 'screenshot path')); break;
    case 'click': args.push('click', element(input, desktopRef)); break;
    case 'fill':
      args.push('set-value', element(input, desktopRef), '--stdin');
      stdin = required(input.text, 'text');
      break;
    case 'press': args.push('press', required(input.key, 'key'), ...app()); break;
    case 'scroll': args.push('scroll', element(input, desktopRef), '--direction', input.direction ?? 'down'); break;
    default: throw new Error(input.action + ' requires target:"browser"');
  }
  return { command: 'agent-desktop', args, stdin, screenshot };
}

export function buildComputerCommand(input: Input, host: Host): Command {
  const root = join(host.home, 'node', 'computer-use');
  const screenshot = input.action === 'screenshot' ? join(root, 'screenshots', randomUUID() + '.png') : undefined;
  if (input.target !== 'browser') return desktopCommand(input, screenshot);
  const hasDia = host.platform === 'darwin' && host.diaInstalled;
  const browser = input.browser ?? (hasDia ? 'dia' : 'chromium');
  if (browser === 'dia' && !hasDia) throw new Error('Dia is unavailable on this node');
  const session = input.session ?? 'default';
  const profile = join(root, 'profiles', browser, session);
  const profilePath = browser === 'dia' ? join(profile, 'User Data') : profile;
  const sessionId = createHash('sha256').update(profile).digest('hex').slice(0, 20);
  const args = ['--session', 'consuelo-cu-' + sessionId, '--config', browserConfig, '--json'];
  let stdin: string | undefined;
  const needsSystemChromium = host.platform === 'linux' && host.arch === 'arm64';
  if (input.action === 'status') return { command: 'agent-browser', args: ['--version'], browser };
  if (input.action === 'confirm' || input.action === 'deny') {
    return { command: 'agent-browser', args: [...args, input.action], browser, profile };
  }
  if (input.action === 'close') return { command: 'agent-browser', args: [...args, 'close'], browser, profile };
  if (needsSystemChromium && !host.systemChromium) {
    throw new BrowserUnavailableError('Install distribution Chromium on this Linux ARM64 node (chromium or chromium-browser) and retry.');
  }
  args.push('--profile', profilePath, '--headed', String(input.headed ?? false));
  if (browser === 'dia') args.push('--executable-path', launcher);
  if (needsSystemChromium && host.systemChromium) args.push('--executable-path', host.systemChromium);
  // Dia can open a page without a layout viewport, even in a headed process.
  const setupArgs = browser === 'dia' && input.action === 'open'
    ? [...args, 'set', 'viewport', '1280', '800'] : undefined;
  switch (input.action) {
    case 'open': args.push('open', required(input.url, 'url')); break;
    case 'snapshot': args.push('snapshot', '-i', '-c'); break;
    case 'click': args.push('click', element(input, browserRef)); break;
    case 'fill':
      args.push('batch', '--bail', '--omit-command');
      stdin = JSON.stringify([['fill', element(input, browserRef), '--', required(input.text, 'text')]]);
      break;
    case 'press': args.push('press', required(input.key, 'key')); break;
    case 'scroll': args.push('scroll', input.direction ?? 'down'); break;
    case 'screenshot': args.push('screenshot', required(screenshot, 'screenshot path')); break;
    default: throw new Error(input.action + ' requires target:"desktop"');
  }
  let chromiumInstallArgs: string[] | undefined;
  if (browser === 'chromium' && !needsSystemChromium) {
    chromiumInstallArgs = host.platform === 'linux' ? ['install', '--with-deps'] : ['install'];
  }
  return { command: 'agent-browser', args, setupArgs, stdin, browser, profile, screenshot, chromiumInstallArgs };
}

function failure(code: ErrorCode, message: string, data: unknown = null): Outcome {
  return { ok: false, code, message, data };
}

export function computerUseFailure(error: unknown, defaultCode: ErrorCode): Outcome {
  const details = error !== null && typeof error === 'object'
    ? error as { code?: unknown; name?: unknown; specifier?: unknown; message?: unknown }
    : {};
  const message = typeof details.message === 'string' ? details.message : '';
  const missingModule = details.code === 'MODULE_NOT_FOUND' || details.code === 'ERR_MODULE_NOT_FOUND'
    || details.name === 'ResolveMessage';
  const optionalProvider = typeof details.specifier === 'string'
    && /^agent-(?:browser|desktop)(?:\/|$)/.test(details.specifier);
  const missingProvider = missingModule && (optionalProvider
    || /Cannot find module ['"]agent-(?:browser|desktop)(?:\/|['"])/.test(message));
  if (error instanceof BrowserUnavailableError) return failure('CLI_MISSING', error.message);
  if (missingProvider) {
    return failure('CLI_MISSING', 'Reinstall Consuelo OS with optional dependencies enabled on this node.');
  }
  return failure(defaultCode, error instanceof Error ? error.message : 'Computer use failed');
}

function readResult(command: Command, result: ProviderProcessResult, action: Input['action']): Outcome {
  if (result.runtimeMissing) {
    return failure('CLI_MISSING', 'Reinstall the OS runtime with optional dependencies enabled on this node.');
  }
  if (result.timedOut || result.cancelled) return failure(result.timedOut ? 'TIMEOUT' : 'CANCELLED', 'Observe the target before repeating an action');
  if (result.stdoutTruncated) return failure('MALFORMED_OUTPUT', 'Output exceeded the limit. Narrow the snapshot or select a window.');
  if (command.browser && action === 'status' && result.exitCode === 0) {
    return { ok: true, code: 'OK', message: 'Browser runtime available', data: { browser: command.browser, version: result.stdout } };
  }
  let output;
  let data;
  try {
    const raw = JSON.parse(result.stdout);
    const batch = Array.isArray(raw);
    output = batch ? raw[0] : raw;
    data = batch ? output?.result : output?.data;
    if (action === 'confirm' && output?.success && data?.confirmed) {
      output = data.result;
      data = output?.data;
    }
  } catch {
    return failure('COMMAND_FAILED', result.stderr.trim() || 'Computer use returned no JSON result');
  }
  if (!output || result.exitCode !== 0 || (command.browser ? output.success !== true : output.ok !== true)) {
    const error = output?.error;
    return failure('COMMAND_FAILED', typeof error === 'string' ? error : error?.message ?? 'Computer use failed', error ?? null);
  }
  if (command.browser && data?.confirmation_required === true) {
    return failure('APPROVAL_REQUIRED', 'The browser policy requires approval before this action can run.', data);
  }
  return { ok: true, code: 'OK', message: 'Computer use completed', data: data ?? null };
}

const browserPolicyVariables = new Set([
  'AGENT_BROWSER_ACTION_POLICY',
  'AGENT_BROWSER_CONFIRM_ACTIONS',
  'AGENT_BROWSER_CONTENT_BOUNDARIES', 'AGENT_BROWSER_MAX_OUTPUT', 'AGENT_BROWSER_NO_AUTO_DIALOG',
]);

// Native browser/desktop providers need a small host environment, not the node's
// API credentials, runtime configuration, or executable injection settings.
const providerHostVariables = new Set([
  'HOME', 'USER', 'LOGNAME', 'PATH', 'SHELL', 'TMPDIR', 'TMP', 'TEMP',
  'LANG', 'LANGUAGE', 'TERM',
  'DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY', 'XDG_RUNTIME_DIR',
  'XDG_SESSION_TYPE', 'XDG_CURRENT_DESKTOP', 'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'DBUS_SESSION_BUS_ADDRESS',
  'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
  'SYSTEMROOT', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PATHEXT', 'COMSPEC',
]);

export function computerEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // Keep explicit action policies. The piped transport surfaces confirmation IDs
  // instead of TTY prompts. Do not inherit unrelated variables by default.
  return Object.fromEntries(Object.entries(env).filter(([key, value]) => {
    if (key === 'AGENT_BROWSER_ALLOWED_DOMAINS') {
      return value?.split(',').some(domain => domain.trim().length > 0);
    }
    return browserPolicyVariables.has(key) || providerHostVariables.has(key.toUpperCase())
      || /^LC_(?:ALL|CTYPE|MESSAGES|COLLATE|NUMERIC|TIME|MONETARY|PAPER|NAME|ADDRESS|TELEPHONE|MEASUREMENT|IDENTIFICATION)$/i.test(key);
  }));
}

export async function executeComputerSteps(
  command: Command,
  action: Input['action'],
  remainingMs: () => number,
  run: (args: string[], timeoutMs: number, stdin?: string) => Promise<ProviderProcessResult>,
  withInstallLock: (operation: () => Promise<Outcome>) => Promise<Outcome>,
): Promise<Outcome> {
  const execute = (args: string[], stdin?: string): Promise<Outcome> => {
    const left = remainingMs();
    if (left <= 0) return Promise.resolve(failure('TIMEOUT', 'The computer use deadline elapsed.'));
    return run(args, left, stdin).then(result => {
      if (args[0] === 'install' && !result.runtimeMissing && !result.timedOut && !result.cancelled) {
        if (result.exitCode === 0) return { ok: true, code: 'OK', message: 'Chromium is available', data: null };
        const detail = [result.stderr, result.stdout].filter(Boolean).join('\n');
        if (args.includes('--with-deps') && /root privileges|permission denied|not in the sudoers|sudo:.*(?:password|terminal|not allowed)|must be.*root/i.test(detail)) {
          return failure('APPROVAL_REQUIRED', 'A node administrator must run agent-browser install --with-deps with package-manager access, then retry.');
        }
        return failure('COMMAND_FAILED', detail || 'Chromium installation failed.');
      }
      return readResult(command, result, action);
    });
  };
  try {
    if (command.setupArgs) {
      let setup = await execute(command.setupArgs);
      // Dia may replace its initial tab. Only repeat the idempotent viewport operation.
      if (!setup.ok && /Auto-launch failed: CDP error .*Target closed/.test(setup.message)) {
        setup = await execute(command.setupArgs);
      }
      if (!setup.ok) return setup.code === 'APPROVAL_REQUIRED'
        ? { ...setup, data: { ...(setup.data as object), setupPending: true } } : setup;
    }
    const outcome = await execute(command.args, command.stdin);
    // The pinned CLI emits this diagnostic before it can launch a browser or navigate.
    const installArgs = command.chromiumInstallArgs;
    const missingBinary = /^(?:Auto-launch failed: )?Chrome not found\. Checked:/.test(outcome.message);
    const missingLibraries = installArgs?.includes('--with-deps') && /^Auto-launch failed: (?:Chrome exited|Failed to launch Chrome)/.test(outcome.message)
      && /error while loading shared libraries: [^:\n]+: cannot open shared object file/.test(outcome.message);
    if (installArgs && action === 'open' && outcome.code === 'COMMAND_FAILED' && (missingBinary || missingLibraries)) {
      const installed = await withInstallLock(() => execute(installArgs));
      if (!installed.ok) return installed;
      return execute(command.args, command.stdin);
    }
    return outcome;
  } catch (error: unknown) {
    if (error instanceof NodeResourceLockError && error.code === 'LOCK_TIMEOUT') {
      return failure('TIMEOUT', 'The browser installation is busy.');
    }
    return computerUseFailure(error, 'COMMAND_FAILED');
  }
}

type BrowserContinuation = { action: 'open'; url: string; headed: boolean };
type BrowserDecision = { id: string; providerId: string; action: string; resume?: BrowserContinuation };

function pendingOutcome(pending: BrowserDecision): Outcome {
  return failure('APPROVAL_REQUIRED', 'Ask the operator about the pending browser action. Use confirm or deny with this ID in the same session.', {
    confirmation_required: true, confirmation_id: pending.id, action: pending.action,
  });
}

// Agent Browser 0.43.0 replays the session's latest parked action regardless of the ID it receives.
// Under the profile lock, bind a one-time OS decision to that action before dispatching any replay.
export async function withBrowserDecision(
  input: Input, command: Command, hasDomainPolicy: boolean,
  dispatch: (continuation?: BrowserContinuation) => Promise<Outcome>,
): Promise<Outcome> {
  if (!command.profile) return dispatch();
  const file = join(command.profile, 'consuelo-browser-confirmation');
  const decision = input.action === 'confirm' || input.action === 'deny';
  let pending: BrowserDecision | undefined;
  if (input.action !== 'close' && existsSync(file)) {
    try {
      const stored = JSON.parse(readFileSync(file, 'utf8'));
      if (typeof stored?.id !== 'string' || typeof stored.providerId !== 'string' || typeof stored.action !== 'string') {
        throw new Error('Invalid pending decision');
      }
      if (stored.resume !== undefined && (stored.resume?.action !== 'open'
        || typeof stored.resume.headed !== 'boolean' || typeof stored.resume.url !== 'string'
        || !ComputerUseInput.safeParse({ target: 'browser', action: 'open', browser: command.browser,
          session: input.session, headed: stored.resume.headed, url: stored.resume.url }).success)) {
        throw new Error('Invalid pending browser continuation');
      }
      pending = stored;
    } catch {
      return failure('COMMAND_FAILED', 'Cannot read the pending browser decision. Close the session to clear it.');
    }
  }
  if (decision) {
    if (!pending || pending.id !== input.confirmationId || (input.action === 'confirm' && input.approved !== true)) {
      return failure('INVALID_INPUT', 'This decision does not match a pending action in this browser session.');
    }
    if (input.action === 'confirm' && hasDomainPolicy && pending.action !== 'close') {
      return failure('INVALID_INPUT', 'The allowed-domains policy is incompatible with this pending action.');
    }
    command.args.push(pending.providerId);
  } else if (pending) {
    return failure('APPROVAL_REQUIRED', 'A previous operation awaits a decision. Use its original confirmation ID or close this session. The new operation has not run.');
  }
  // Confirmation can execute a side effect, so consume it before dispatch to
  // prevent retries from replaying it. Failed deny/close must not lose the
  // parked decision: the provider may still have the action awaiting approval.
  if (input.action === 'confirm') rmSync(file, { force: true });
  let outcome = await dispatch();
  // A confirmation replays only the provider's parked viewport command.
  // Resume the original navigation under the same session lock, so its own
  // navigation confirmation policy still runs and can create a new decision.
  if (input.action === 'confirm' && outcome.ok && pending?.resume) {
    outcome = await dispatch(pending.resume);
  }
  const data = outcome.data as { confirmation_id?: unknown; action?: unknown; setupPending?: unknown } | null;
  if (outcome.code === 'APPROVAL_REQUIRED' && typeof data?.confirmation_id === 'string' && typeof data.action === 'string') {
    const next: BrowserDecision = { id: randomUUID(), providerId: data.confirmation_id, action: data.action,
      ...(input.action === 'open' && command.setupArgs && data.setupPending === true
        ? { resume: { action: 'open' as const, url: required(input.url, 'url'), headed: input.headed ?? false } } : {}),
    };
    mkdirSync(command.profile, { recursive: true, mode: 0o700 });
    writeFileSync(file, JSON.stringify(next), { mode: 0o600 });
    return pendingOutcome(next);
  }
  if (outcome.ok && (input.action === 'deny' || input.action === 'close')) rmSync(file, { force: true });
  if (outcome.ok && (input.action === 'close' || (input.action === 'confirm' && pending?.action === 'close'))) {
    rmSync(join(command.profile, 'consuelo-browser-mode'), { force: true });
  }
  return outcome;
}

export async function runComputerUse(input: Input, env: NodeJS.ProcessEnv, timeoutMs: number): Promise<Outcome> {
  const childEnv = computerEnvironment(env);
  if (input.target === 'browser' && childEnv.AGENT_BROWSER_ALLOWED_DOMAINS
    && !['status', 'close', 'confirm', 'deny'].includes(input.action)) {
    return failure('INVALID_INPUT', 'The allowed-domains policy requires a fresh context and is incompatible with persistent profiles used by computer.use.');
  }
  const deadline = performance.now() + timeoutMs;
  const remainingMs = () => Math.max(0, Math.ceil(deadline - performance.now()));
  const host: Host = {
    home: resolveOsHome(env.CONSUELO_HOME ?? env.CONSUELO_OS_HOME), platform: process.platform, arch: process.arch,
    diaInstalled: existsSync(diaExecutable),
    systemChromium: input.target === 'browser' && process.platform === 'linux' && process.arch === 'arm64'
      ? linuxArm64Chromium() : undefined,
  };
  let command: Command;
  try {
    command = buildComputerCommand(input, host);
  } catch (error: unknown) {
    return computerUseFailure(error, 'VALIDATION_ERROR');
  }
  if (command.browser === 'dia' && command.profile) {
    childEnv.CONSUELO_BROWSER_DIA_PROFILE = command.profile;
  }
  const run = async (): Promise<Outcome> => {
    const profile = command.profile;
    const modeFile = profile && join(profile, 'consuelo-browser-mode');
    try {
      return await withBrowserDecision(input, command, Boolean(childEnv.AGENT_BROWSER_ALLOWED_DOMAINS), async continuation => {
        const activeInput: Input = continuation
          ? ComputerUseInput.parse({ ...input, ...continuation, confirmationId: undefined, approved: undefined }) : input;
        const activeCommand = continuation ? { ...buildComputerCommand(activeInput, host), setupArgs: undefined } : command;
        if (profile && modeFile && !['close', 'confirm', 'deny'].includes(activeInput.action)) {
          mkdirSync(profile, { recursive: true, mode: 0o700 });
          const mode = activeInput.headed ? 'headed' : 'headless';
          if (existsSync(modeFile) && readFileSync(modeFile, 'utf8') !== mode) {
            return failure('INVALID_INPUT', 'Close this browser session before switching headed mode. Its profile is retained.');
          }
          writeFileSync(modeFile, mode, { mode: 0o600 });
        }
        if (activeCommand.screenshot) mkdirSync(dirname(activeCommand.screenshot), { recursive: true, mode: 0o700 });
        const provider = createNodeProviderProcess({ maxOutputBytes: 1024 * 1024 });
        const request = { command: providerExecutable(activeCommand.command, childEnv), cwd: dirname(browserConfig), env: childEnv };
        return executeComputerSteps(activeCommand, activeInput.action, remainingMs,
          (args, left, stdin) => Effect.runPromise(provider.run({ ...request, args, stdin, timeoutMs: left })),
          operation => withNodeResourceLock({
            lockPath: nodeResourceLockPath(join(host.home, 'node', 'computer-use', 'chromium-install')),
            operationId: 'computer.use:install', waitTimeoutMs: remainingMs(),
          }, operation),
        );
      });
    } catch (error: unknown) {
      return computerUseFailure(error, 'COMMAND_FAILED');
    }
  };
  try {
    return await (command.profile ? withNodeResourceLock({
      lockPath: nodeResourceLockPath(command.profile), operationId: 'computer.use', waitTimeoutMs: remainingMs(),
    }, run) : run());
  } catch (error: unknown) {
    if (error instanceof NodeResourceLockError && error.code === 'LOCK_TIMEOUT') {
      return failure('TIMEOUT', 'Another operation is using this browser session.');
    }
    return computerUseFailure(error, 'COMMAND_FAILED');
  }
}
