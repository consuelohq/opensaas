import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { Effect } from 'effect';

import {
  closeBrowserEffect,
  createBrowserContext,
  headedBrowserEffect,
  openBrowserEffect,
  runBrowserCommandEffect,
  statusBrowserEffect,
} from './service';
import type { BrowserProcessResult } from './types';

const CONSUELO_URL = process.env.AGENT_CONSUELO_URL || 'https://consuelo.consuelohq.com';
const APP_URL = process.env.AGENT_APP_URL || 'https://app.consuelohq.com';
const context = createBrowserContext();

const DEVICE_PRESETS: Record<string, { device?: string; width?: number; height?: number }> = {
  mobile: { device: 'iPhone 16 Pro' },
  iphone: { device: 'iPhone 16 Pro' },
  tablet: { device: 'iPad Pro 11' },
  ipad: { device: 'iPad Pro 11' },
  desktop: { width: 1440, height: 900 },
};

type CliOptions = {
  headed: boolean;
  full: boolean;
  json: boolean;
  preset?: string;
  device?: string;
  provider?: string;
  width?: string;
  height?: string;
  colorScheme?: string;
};

function out(value = ''): void { process.stdout.write(value + '\n'); }
function err(value = ''): void { process.stderr.write(value + '\n'); }

function help(): void {
  [
    'usage: bun run browser -- <command> [options]',
    '',
    'agent-browser wrapper using one persistent browser home.',
    `browser home: ${context.config.profilePath}`,
    '',
    'commands:',
    '  open|url <url>       open URL and capture page evidence',
    '  headed <url>         open visibly for user login, MFA, CAPTCHA, passkeys, or consent',
    '  status               report safe daemon/page metadata',
    '  consuelo             open consuelo.consuelohq.com',
    '  app                  open app.consuelohq.com',
    '  screenshot [name]    capture screenshot',
    '  snap                 capture accessibility tree',
    '  click|dblclick       interact by accessibility ref',
    '  fill|type            enter text',
    '  find|get|wait        inspect and wait for browser state',
    '  tabs|cookies         manage tabs or cookies',
    '  network|trace        inspect browser runtime',
    '  raw <args...>        pass through to agent-browser',
    '  close                explicitly close browser sessions',
    '',
    'options:',
    '  --headed             compatibility alias for the headed lifecycle',
    '  --full               full-page screenshot',
    '  --preset <name>      desktop, mobile, tablet, ipad, iphone',
    '  --device <name>      agent-browser device name',
    '  --provider <name>    browser provider',
    '  --width/--height     viewport dimensions',
    '  --color-scheme <v>   dark, light, no-preference',
  ].forEach(out);
}

function parse(argv: string[]): { opts: CliOptions; args: string[] } {
  const opts: CliOptions = { headed: false, full: false, json: false };
  const args: string[] = [];
  const valueFlags = new Set(['--preset', '--device', '--provider', '--width', '--height', '--color-scheme']);
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--headed' || value === '--full' || value === '--json') {
      if (value === '--headed') opts.headed = true;
      if (value === '--full') opts.full = true;
      if (value === '--json') opts.json = true;
      continue;
    }
    if (valueFlags.has(value)) {
      const next = argv[index + 1];
      if (next !== undefined) {
        if (value === '--preset') opts.preset = next;
        if (value === '--device') opts.device = next;
        if (value === '--provider') opts.provider = next;
        if (value === '--width') opts.width = next;
        if (value === '--height') opts.height = next;
        if (value === '--color-scheme') opts.colorScheme = next;
        index += 1;
      }
      continue;
    }
    args.push(value);
  }
  const preset = opts.preset ? DEVICE_PRESETS[opts.preset.toLowerCase()] : undefined;
  if (preset) {
    opts.device ||= preset.device;
    opts.width ||= preset.width === undefined ? undefined : String(preset.width);
    opts.height ||= preset.height === undefined ? undefined : String(preset.height);
  }
  return { opts, args };
}

function run(args: string[], useProfile = true): Promise<BrowserProcessResult> {
  return Effect.runPromise(runBrowserCommandEffect({ args, useProfile }, context));
}

function asCliError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function emit(result: BrowserProcessResult): void {
  if (result.stdout) out(result.stdout);
  if (result.exitCode !== 0) {
    out(`error: ${result.stderr || result.stdout || `exit code ${result.exitCode}`}`);
    process.exitCode = 1;
  }
}

async function applyPageOptions(opts: CliOptions): Promise<void> {
  try {
    if (opts.device) await run(['set', 'device', opts.device]);
    if (opts.colorScheme === 'dark' || opts.colorScheme === 'light') await run(['set', 'media', opts.colorScheme]);
    if (opts.width && opts.height) await run(['set', 'viewport', opts.width, opts.height]);
  } catch (cause: unknown) {
    throw asCliError(cause);
  }
}

function screenshotPath(name = 'page'): string {
  mkdirSync(context.config.screenshotDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return join(context.config.screenshotDir, `${name}-${timestamp}.png`);
}

async function headed(url: string): Promise<void> {
  try {
    const result = await Effect.runPromise(headedBrowserEffect({ url }, context));
    out(JSON.stringify(result, null, 2));
  } catch (cause: unknown) {
    throw asCliError(cause);
  }
}

async function open(url: string, opts: CliOptions): Promise<void> {
  try {
    if (opts.headed) {
      await headed(url);
      return;
    }
    await Effect.runPromise(openBrowserEffect({ url }, context));
    await applyPageOptions(opts);
    await run(['wait', '--load', 'networkidle']);
    const snapshot = await run(['snapshot', '-i']);
    const path = screenshotPath(new URL(url).hostname);
    await run(['screenshot', path, ...(opts.full ? ['--full'] : [])]);
    const title = await run(['get', 'title']);
    const currentUrl = await run(['get', 'url']);
    out('');
    out(`url: ${currentUrl.stdout}`);
    out(`title: ${title.stdout}`);
    out(`screenshot: ${path}`);
    out('');
    out('--- interactive elements ---');
    out(snapshot.stdout);
  } catch (cause: unknown) {
    throw asCliError(cause);
  }
}

async function interact(command: string, args: string[]): Promise<void> {
  try {
    const result = await run([command, ...args]);
    emit(result);
    if (result.exitCode !== 0) return;
    await run(['wait', '500']);
    const snapshot = await run(['snapshot', '-i']);
    if (snapshot.stdout) {
      out('');
      out('--- updated elements ---');
      out(snapshot.stdout);
    }
  } catch (cause: unknown) {
    throw asCliError(cause);
  }
}

async function tabs(argv: string[]): Promise<void> {
  try {
    const action = argv[1];
    const parts = argv.slice(2);
    const labelIndex = parts.indexOf('--label');
    const label = labelIndex >= 0 ? parts[labelIndex + 1] : undefined;
    const cleaned = labelIndex >= 0 ? parts.filter((_, i) => i !== labelIndex && i !== labelIndex + 1) : parts;
    const positional = cleaned.filter((part) => !part.startsWith('-'));
    if (!action || action === 'list') return emit(await run(['tab', ...cleaned]));
    if (action === 'new') {
      const destination = positional.at(-1);
      const destinationIndex = destination === undefined ? -1 : cleaned.lastIndexOf(destination);
      const forwarded = cleaned.filter((_, index) => index !== destinationIndex);
      return emit(await run(['tab', 'new', ...(label ? ['--label', label] : []), ...forwarded, ...(destination ? [destination] : [])]));
    }
    if (action === 'select' || action === 'switch') return emit(await run(['tab', positional[0] || '']));
    if (action === 'close') return emit(await run(['tab', 'close', ...(positional[0] ? [positional[0]] : [])]));
    emit(await run(['tab', action, ...cleaned]));
  } catch (cause: unknown) {
    throw asCliError(cause);
  }
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  try {
    const { opts, args } = parse(argv);
    const command = args[0];
    if (!command || command === '--help' || command === 'help') return help();
    if (command === 'login' || command === 'reauth') {
      throw new Error('browser.login and browser.reauth were removed; use browser.headed <url>');
    }
    if (command === 'raw') return emit(await run(args.slice(1)));
    if (command === 'headed') {
      if (!args[1]) throw new Error('url required. usage: bun run browser -- headed <url>');
      return headed(args[1]);
    }
    if (command === 'status') return out(JSON.stringify(await Effect.runPromise(statusBrowserEffect({}, context)), null, 2));
    if (command === 'open' || command === 'url') {
      if (!args[1]) throw new Error('url required. usage: bun run browser -- open <url>');
      return open(args[1], opts);
    }
    if (command === 'consuelo') return open(CONSUELO_URL, opts);
    if (command === 'app') return open(APP_URL, opts);
    if (command === 'close') {
      await Effect.runPromise(closeBrowserEffect(context));
      return out('browser closed');
    }
    if (command === 'screenshot' || command === 'ss') {
      await applyPageOptions(opts);
      const path = screenshotPath(args[1]);
      emit(await run(['screenshot', path, ...(opts.full ? ['--full'] : [])]));
      return out(`screenshot: ${path}`);
    }
    if (command === 'snap' || command === 'snapshot') return emit(await run(['snapshot', '-i']));
    if (command === 'click') return interact('click', [args[1]]);
    if (command === 'dblclick') return interact('dblclick', [args[1]]);
    if (command === 'fill') return interact('fill', [args[1], args.slice(2).join(' ')]);
    if (command === 'type') return emit(await run(['type', args[1], args.slice(2).join(' ')]));
    if (command === 'hover') return emit(await run(['hover', args[1]]));
    if (command === 'select' || command === 'check' || command === 'uncheck') return interact(command, args.slice(1));
    if (command === 'scroll') return emit(await run(['scroll', ...args.slice(1)]));
    if (command === 'eval') return emit(await run(['eval', args.slice(1).join(' ')]));
    if (command === 'get') {
      const target = args[1] === 'attribute' ? 'attr' : args[1];
      return emit(await run(['get', ...(target ? [target] : []), ...args.slice(2)]));
    }
    if (command === 'tabs') return tabs(args);
    if (command === 'cookies') {
      const [, action, name, value] = args;
      return emit(await run(!action || action === 'list' ? ['cookies'] : ['cookies', action, ...(name ? [name] : []), ...(value ? [value] : [])]));
    }
    if (command === 'network' && args[1] === 'requests') {
      const result = await run(args);
      const noise = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)|^data:|\/webpack|\/hot-update|\/socket\.io|\/ws$|__nextjs|_next\/static|chrome-extension/i;
      const filtered = result.stdout.split('\n').filter((line) => line.trim() && !noise.test(line));
      result.stdout = filtered.join('\n') || 'no meaningful network requests (all filtered as static assets)';
      return emit(result);
    }
    if (['wait', 'find', 'batch', 'tab', 'storage', 'console', 'errors', 'download', 'clipboard', 'set', 'dialog', 'network', 'trace'].includes(command)) {
      return emit(await run(args));
    }
    emit(await run(args));
  } catch (cause: unknown) {
    throw asCliError(cause);
  }
}

export async function runBrowserCli(argv?: string[]): Promise<void> {
  try {
    await main(argv);
  } catch (cause: unknown) {
    const message = asCliError(cause).message;
    out(`error: ${message}`);
    process.exitCode = 1;
  }
}
