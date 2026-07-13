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
    out(`error: ${result.stderr || `exit code ${result.exitCode}`}`);
    process.exitCode = 1;
  }
}

function emitRun(args: string[]): Promise<void> {
  return run(args).then(emit);
}

function applyPageOptions(opts: CliOptions): Promise<void> {
  const commands: string[][] = [];
  if (opts.device) commands.push(['set', 'device', opts.device]);
  if (opts.colorScheme === 'dark' || opts.colorScheme === 'light') {
    commands.push(['set', 'media', opts.colorScheme]);
  }
  if (opts.width && opts.height) commands.push(['set', 'viewport', opts.width, opts.height]);

  return commands.reduce<Promise<void>>(
    (previous, command) => previous.then(() => run(command)).then(() => undefined),
    Promise.resolve(),
  );
}

function screenshotPath(name = 'page'): string {
  mkdirSync(context.config.screenshotDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return join(context.config.screenshotDir, `${name}-${timestamp}.png`);
}

function headed(url: string, opts: CliOptions): Promise<void> {
  return Effect.runPromise(headedBrowserEffect({ url, provider: opts.provider }, context))
    .then((result) => out(JSON.stringify(result, null, 2)));
}

function open(url: string, opts: CliOptions): Promise<void> {
  if (opts.headed) return headed(url, opts);

  return Effect.runPromise(openBrowserEffect({ url, provider: opts.provider }, context))
    .then(() => applyPageOptions(opts))
    .then(() => run(['wait', '--load', 'networkidle']))
    .then(() => run(['snapshot', '-i']))
    .then((snapshot) => {
      const path = screenshotPath(new URL(url).hostname);
      return run(['screenshot', path, ...(opts.full ? ['--full'] : [])])
        .then(() => Promise.all([run(['get', 'title']), run(['get', 'url'])]))
        .then(([title, currentUrl]) => {
          out('');
          out(`url: ${currentUrl.stdout}`);
          out(`title: ${title.stdout}`);
          out(`screenshot: ${path}`);
          out('');
          out('--- interactive elements ---');
          out(snapshot.stdout);
        });
    });
}

function interact(command: string, args: string[]): Promise<void> {
  return run([command, ...args]).then((result) => {
    emit(result);
    if (result.exitCode !== 0) return undefined;
    return run(['wait', '500'])
      .then(() => run(['snapshot', '-i']))
      .then((snapshot) => {
        if (!snapshot.stdout) return;
        out('');
        out('--- updated elements ---');
        out(snapshot.stdout);
      });
  });
}

function tabs(argv: string[]): Promise<void> {
  const action = argv[1];
  const parts = argv.slice(2);
  const labelIndex = parts.indexOf('--label');
  const label = labelIndex >= 0 ? parts[labelIndex + 1] : undefined;
  const cleaned = labelIndex >= 0
    ? parts.filter((_, index) => index !== labelIndex && index !== labelIndex + 1)
    : parts;
  const positional = cleaned.filter((part) => !part.startsWith('-'));

  if (!action || action === 'list') return emitRun(['tab', ...cleaned]);
  if (action === 'new') {
    const destination = positional.at(-1);
    const destinationIndex = destination === undefined ? -1 : cleaned.lastIndexOf(destination);
    const forwarded = cleaned.filter((_, index) => index !== destinationIndex);
    return emitRun([
      'tab',
      'new',
      ...(label ? ['--label', label] : []),
      ...forwarded,
      ...(destination ? [destination] : []),
    ]);
  }
  if (action === 'select' || action === 'switch') return emitRun(['tab', positional[0] || '']);
  if (action === 'close') return emitRun(['tab', 'close', ...(positional[0] ? [positional[0]] : [])]);
  return emitRun(['tab', action, ...cleaned]);
}

function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv[0] === 'raw') return emitRun(argv.slice(1));

  const { opts, args } = parse(argv);
  const command = args[0];
  if (!command || command === '--help' || command === 'help') {
    help();
    return Promise.resolve();
  }
  if (command === 'login' || command === 'reauth') {
    throw new Error('browser.login and browser.reauth were removed; use browser.headed <url>');
  }
  if (command === 'headed') {
    if (!args[1]) throw new Error('url required. usage: bun run browser -- headed <url>');
    return headed(args[1], opts);
  }
  if (command === 'status') {
    return Effect.runPromise(statusBrowserEffect({}, context))
      .then((result) => out(JSON.stringify(result, null, 2)));
  }
  if (command === 'open' || command === 'url') {
    if (!args[1]) throw new Error('url required. usage: bun run browser -- open <url>');
    return open(args[1], opts);
  }
  if (command === 'consuelo') return open(CONSUELO_URL, opts);
  if (command === 'app') return open(APP_URL, opts);
  if (command === 'close') {
    return Effect.runPromise(closeBrowserEffect(context)).then(() => out('browser closed'));
  }
  if (command === 'screenshot' || command === 'ss') {
    return applyPageOptions(opts).then(() => {
      const path = screenshotPath(args[1]);
      return run(['screenshot', path, ...(opts.full ? ['--full'] : [])]).then((result) => {
        emit(result);
        if (result.exitCode === 0) out(`screenshot: ${path}`);
      });
    });
  }
  if (command === 'snap' || command === 'snapshot') return emitRun(['snapshot', '-i']);
  if (command === 'click') return interact('click', [args[1]]);
  if (command === 'dblclick') return interact('dblclick', [args[1]]);
  if (command === 'fill') return interact('fill', [args[1], args.slice(2).join(' ')]);
  if (command === 'type') return interact('type', [args[1], args.slice(2).join(' ')]);
  if (command === 'hover') return emitRun(['hover', args[1]]);
  if (command === 'select' || command === 'check' || command === 'uncheck') {
    return interact(command, args.slice(1));
  }
  if (command === 'scroll') return emitRun(['scroll', ...args.slice(1)]);
  if (command === 'eval') return emitRun(['eval', args.slice(1).join(' ')]);
  if (command === 'get') {
    const target = args[1] === 'attribute' ? 'attr' : args[1];
    return emitRun(['get', ...(target ? [target] : []), ...args.slice(2)]);
  }
  if (command === 'tabs') return tabs(args);
  if (command === 'cookies') {
    const [, action, name, value] = args;
    return emitRun(!action || action === 'list'
      ? ['cookies']
      : ['cookies', action, ...(name ? [name] : []), ...(value ? [value] : [])]);
  }
  if (command === 'network' && args[1] === 'requests') {
    if (opts.json) return emitRun(['--json', ...args]);
    return run(args).then((result) => {
      const noise = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)|^data:|\/webpack|\/hot-update|\/socket\.io|\/ws$|__nextjs|_next\/static|chrome-extension/i;
      const filtered = result.stdout.split('\n').filter((line) => line.trim() && !noise.test(line));
      result.stdout = filtered.join('\n') || 'no meaningful network requests (all filtered as static assets)';
      emit(result);
    });
  }
  if (['wait', 'find', 'batch', 'tab', 'storage', 'console', 'errors', 'download', 'clipboard', 'set', 'dialog', 'network', 'trace'].includes(command)) {
    return emitRun(args);
  }
  return emitRun(args);
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
