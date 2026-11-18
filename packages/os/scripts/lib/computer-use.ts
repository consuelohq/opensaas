import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';
import type { z } from 'zod';

import { createNodeProviderProcess } from '../../tools/deployment-provider/process';
import type { ProviderProcessResult } from '../../tools/deployment-provider/types';
import { resolveOsHome } from './install-state';
import { withNodeResourceLock, nodeResourceLockPath } from './node-resource-lock';
import type { ComputerUseInput } from './facade/schemas';
import type { ErrorCode } from './facade/types';

type Input = z.infer<typeof ComputerUseInput>;
type Host = { home: string; platform: NodeJS.Platform; diaInstalled: boolean };
type Command = {
  command: string;
  args: string[];
  stdin?: string;
  setupArgs?: string[];
  profile?: string;
  browser?: 'dia' | 'chromium';
  screenshot?: string;
};
type Outcome = { ok: boolean; code: ErrorCode; message: string; data: unknown };

const requirePackage = createRequire(import.meta.url);

function providerExecutable(command: string, env: NodeJS.ProcessEnv): string {
  if (command === 'agent-browser') {
    const root = dirname(requirePackage.resolve('agent-browser/package.json'));
    const { nativeTarget, findNativeBinary } = requirePackage('agent-browser/scripts/native.js');
    const target = nativeTarget();
    const binary = target && findNativeBinary(root, target);
    if (!binary) throw new Error('Install the OS runtime with optional dependencies for this platform');
    return binary;
  }
  const root = dirname(requirePackage.resolve('agent-desktop/package.json'));
  const { resolve } = requirePackage('agent-desktop/lib/platform.js');
  const target = resolve(process.platform, process.arch);
  if (!target) throw new Error('Agent Desktop does not support this platform');
  if (process.platform === 'darwin') env.AGENT_DESKTOP_MACOS_HELPER_PATH = join(root, 'bin', 'agent-desktop-macos-helper-darwin-' + process.arch);
  return join(root, 'bin', target.binaryName);
}

const diaExecutable = '/Applications/Dia.app/Contents/MacOS/Dia';
const launcher = fileURLToPath(new URL('../chrome-stderr-safe.sh', import.meta.url));
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
  if (input.action === 'status') return { command: 'agent-browser', args: ['--version'], browser };
  args.push('--profile', profilePath, '--headed', String(input.headed ?? false));
  if (browser === 'dia') args.push('--executable-path', launcher);
  // Dia can open a page without a layout viewport, even in a headed process.
  const setupArgs = browser === 'dia' && input.action === 'open'
    ? [...args, 'set', 'viewport', '1280', '800'] : undefined;
  switch (input.action) {
    case 'open': args.push('open', required(input.url, 'url')); break;
    case 'snapshot': args.push('snapshot', '-i', '-c'); break;
    case 'click': args.push('click', element(input, browserRef)); break;
    case 'fill':
      args.push('batch', '--bail');
      stdin = JSON.stringify([['fill', element(input, browserRef), required(input.text, 'text')]]);
      break;
    case 'press': args.push('press', required(input.key, 'key')); break;
    case 'scroll': args.push('scroll', input.direction ?? 'down'); break;
    case 'screenshot': args.push('screenshot', required(screenshot, 'screenshot path')); break;
    case 'close': args.push('close'); break;
    default: throw new Error(input.action + ' requires target:"desktop"');
  }
  return { command: 'agent-browser', args, setupArgs, stdin, browser, profile, screenshot };
}

function failure(code: ErrorCode, message: string, data: unknown = null): Outcome {
  return { ok: false, code, message, data };
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
  try {
    output = JSON.parse(result.stdout);
    if (Array.isArray(output)) output = output[0];
  } catch {
    return failure('COMMAND_FAILED', result.stderr.trim() || 'Computer use returned no JSON result');
  }
  if (!output || result.exitCode !== 0 || (command.browser ? output.success !== true : output.ok !== true)) {
    const error = output?.error;
    return failure('COMMAND_FAILED', typeof error === 'string' ? error : error?.message ?? 'Computer use failed', error ?? null);
  }
  return { ok: true, code: 'OK', message: 'Computer use completed', data: output.data ?? null };
}

const browserPolicyVariables = new Set([
  'AGENT_BROWSER_ACTION_POLICY', 'AGENT_BROWSER_ALLOWED_DOMAINS',
  'AGENT_BROWSER_CONFIRM_ACTIONS', 'AGENT_BROWSER_CONFIRM_INTERACTIVE',
  'AGENT_BROWSER_CONTENT_BOUNDARIES', 'AGENT_BROWSER_NO_AUTO_DIALOG',
]);

export function computerEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // Keep operator policies. This tool owns the provider, profile, and headed mode.
  return Object.fromEntries(Object.entries(env).filter(([key]) =>
    browserPolicyVariables.has(key) || (!key.startsWith('AGENT_BROWSER_') && !key.startsWith('AGENT_DESKTOP_')),
  ));
}

export async function runComputerUse(input: Input, env: NodeJS.ProcessEnv, timeoutMs: number): Promise<Outcome> {
  const host = { home: resolveOsHome(env.CONSUELO_HOME ?? env.CONSUELO_OS_HOME), platform: process.platform, diaInstalled: existsSync(diaExecutable) };
  let command: Command;
  try {
    command = buildComputerCommand(input, host);
  } catch (error: unknown) {
    return failure('VALIDATION_ERROR', error instanceof Error ? error.message : 'Invalid computer use input');
  }
  const childEnv = computerEnvironment(env);
  if (command.browser === 'dia' && command.profile) {
    childEnv.CONSUELO_BROWSER_DIA_PROFILE = command.profile;
    childEnv.CONSUELO_BROWSER_CHROME_BINARY = diaExecutable;
  }
  const run = async (): Promise<Outcome> => {
    const profile = command.profile;
    const modeFile = profile && join(profile, 'consuelo-browser-mode');
    try {
      if (profile && modeFile) {
        mkdirSync(profile, { recursive: true, mode: 0o700 });
        if (input.action !== 'close') {
          const mode = input.headed ? 'headed' : 'headless';
          if (existsSync(modeFile) && readFileSync(modeFile, 'utf8') !== mode) {
            return failure('INVALID_INPUT', 'Close this browser session before switching headed mode. Its profile is retained.');
          }
          writeFileSync(modeFile, mode, { mode: 0o600 });
        }
      }
      if (command.screenshot) mkdirSync(dirname(command.screenshot), { recursive: true, mode: 0o700 });
      const provider = createNodeProviderProcess({ maxOutputBytes: 1024 * 1024 });
      const request = { command: providerExecutable(command.command, childEnv), cwd: dirname(browserConfig), env: childEnv, timeoutMs };
      if (command.setupArgs) {
        const setViewport = () => Effect.runPromise(provider.run({ ...request, args: command.setupArgs! }));
        let setup = readResult(command, await setViewport(), input.action);
        // Dia replaces its startup tab while initializing. Only repeat the idempotent viewport setup.
        if (!setup.ok && /Auto-launch failed: CDP error .*Target closed/.test(setup.message)) {
          setup = readResult(command, await setViewport(), input.action);
        }
        if (!setup.ok) return setup;
      }
      const result = await Effect.runPromise(provider.run({ ...request, args: command.args, stdin: command.stdin }));
      const outcome = readResult(command, result, input.action);
      if (outcome.ok && input.action === 'close' && modeFile) rmSync(modeFile, { force: true });
      return outcome;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
        return failure('CLI_MISSING', 'Reinstall the OS runtime with optional dependencies enabled on this node.');
      }
      return failure('COMMAND_FAILED', error instanceof Error ? error.message : 'Computer use failed');
    }
  };
  return command.profile ? withNodeResourceLock({
    lockPath: nodeResourceLockPath(command.profile), operationId: 'computer.use', waitTimeoutMs: timeoutMs,
  }, run) : run();
}
