#!/usr/bin/env bun

// browser.js — agent-friendly browser automation wrapper
// uses agent-browser with ko's persistent profile (already authenticated)
// usage: bun run browser -- <command> [options]

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const PROFILE = '/Users/kokayi/.agent-browser-ko';
const SCREENSHOT_DIR = '/tmp/opensaas-screenshots';
const CONSUELO_URL = 'https://consuelo.consuelohq.com';
const APP_URL = 'https://app.consuelohq.com';

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function printHelp() {
  const lines = [
    'usage: bun run browser -- <command> [options]',
    '',
    'agent-friendly browser wrapper with ko\'s auth profile.',
    'screenshots go to /tmp/opensaas-screenshots/.',
    '',
    'commands:',
    '  open|url <url>       open url, wait for load, snapshot, screenshot',
    '    --preset mobile     use preset: desktop, mobile, tablet, ipad',
    '    --device <name>     emulate device (e.g. "iPhone 16 Pro")',
    '    --provider <name>   browser provider, e.g. ios',
    '    --width <px>        viewport width; requires --height',
    '    --height <px>       viewport height; requires --width',
    '    --color-scheme <v>  dark, light, or no-preference',
    '  consuelo             open consuelo.consuelohq.com (internal CRM)',
    '  app                  open app.consuelohq.com (production)',
    '  screenshot [name]    take screenshot of current page',
    '  snap                 snapshot current page (accessibility tree)',
    '  click <ref>          click element by ref (@e1, @e2, etc.)',
    '  dblclick <ref>       double-click element',
    '  fill <ref> <text>    fill input by ref',
    '  type <ref> <text>    type into element (no clear)',
    '  hover <ref>          hover element',
    '  select <ref> <val>   select dropdown option',
    '  check <ref>          check checkbox',
    '  uncheck <ref>        uncheck checkbox',
    '  scroll <dir> [px]    scroll up/down/left/right',
    '  login <name>         run saved auth login',
    '  reauth [name]        close daemon, restart profile, run saved auth login',
    '  eval <js>            run javascript on current page',
    '  close                close the browser',
    '',
    '  wait <sel|ms>        wait for element, time, or condition',
    '    --text "str"       wait for text to appear',
    '    --url "pattern"    wait for url match',
    '    --load networkidle wait for network idle',
    '    --fn "js expr"     wait for js condition',
    '',
    '  find <by> <val> <action> [text]  semantic locator',
    '    by: role, text, label, placeholder, alt, title, testid',
    '    action: click, fill, type, hover, focus, check, text',
    '    e.g. find role button click --name "Submit"',
    '    e.g. find label "Email" fill "test@test.com"',
    '',
    '  tab                  list tabs',
    '  tab new [url]        new tab (--label <name>)',
    '  tab <id|label>       switch tab',
    '  tab close [id]       close tab',
    '',
    '  cookies              list cookies',
    '  cookies set <n> <v>  set cookie',
    '  cookies clear        clear cookies',
    '  storage local        list localStorage',
    '  storage local <key>  get key',
    '',
    '  network requests     list network requests (--filter, --type, --method, --status)',
    '  network har start    start HAR recording',
    '  network har stop [f] stop and save HAR',
    '',
    '  console              view console messages',
    '  errors               view page errors',
    '  download <ref> <path> click to download',
    '  clipboard read       read clipboard',
    '  clipboard write <t>  write to clipboard',
    '',
    '  set viewport <w> <h> set viewport size',
    '  set device <name>    emulate device ("iPhone 14")',
    '  set media dark|light color scheme',
    '',
    '  dialog accept [text] accept dialog',
    '  dialog dismiss       dismiss dialog',
    '',
    '  batch "cmd1" "cmd2"  run multiple commands (--bail to stop on error)',
    '',
    '  raw <...args>        pass args directly to agent-browser',
    '',
    `profile: ${PROFILE}`,
    'set AGENT_BROWSER_PROFILE to override the persistent profile path.',
    '',
    'options:',
    '  --headed             show browser window (visible to ko)',
    '  --full               full page screenshot',
    '  --json               json output',
    '  --preset <name>      desktop, mobile, tablet, ipad',
    '  --device <name>      agent-browser device name',
    '  --provider <name>    agent-browser provider name',
    '  --width <px>         viewport width; requires --height',
    '  --height <px>        viewport height; requires --width',
    '  --color-scheme <v>   dark, light, or no-preference',
    '  --help               show this help',
  ];
  lines.forEach((l) => writeStdout(l));
}

function ensureScreenshotDir() {
  try { execSync(`mkdir -p ${SCREENSHOT_DIR}`, { encoding: 'utf8' }); } catch {}
}

function shouldUseProfile(args) {
  if (!PROFILE) return false;
  if (args.includes('--profile')) return false;

  const command = args.find((arg) => !arg.startsWith('--'));
  return !['close', 'profiles', 'install', 'upgrade'].includes(command);
}

function withProfile(args, { useProfile = true } = {}) {
  if (!useProfile || !shouldUseProfile(args)) return args;
  return ['--profile', PROFILE, ...args];
}

function run(args, { silent = false, useProfile = true } = {}) {
  const runArgs = withProfile(args, { useProfile });
  const cmd = ['agent-browser', ...runArgs].join(' ');
  if (!silent) writeStderr(`> ${cmd}`);
  const result = spawnSync('agent-browser', runArgs, {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    ok: result.status === 0,
  };
}

function screenshotPath(name) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = name || 'page';
  return path.join(SCREENSHOT_DIR, `${slug}-${ts}.png`);
}

const DEVICE_PRESETS = {
  mobile: { device: 'iPhone 16 Pro' },
  iphone: { device: 'iPhone 16 Pro' },
  tablet: { device: 'iPad Pro 11' },
  ipad: { device: 'iPad Pro 11' },
  desktop: { width: 1440, height: 900 },
};

const BOOLEAN_FLAGS = new Set(['--headed', '--full', '--json']);
const VALUE_FLAGS = new Set(['--preset', '--device', '--provider', '--width', '--height', '--color-scheme']);

function parseOptions(argv) {
  const opts = { headed: false, full: false, json: false };
  const args = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (BOOLEAN_FLAGS.has(arg)) {
      opts[arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = true;
      continue;
    }

    if (VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (value !== undefined) {
        opts[arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
        index += 1;
      }
      continue;
    }

    if (arg.startsWith('--')) continue;
    args.push(arg);
  }

  applyPresetDefaults(opts);
  return { opts, args };
}

function parsePositiveInteger(value) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function applyPresetDefaults(opts) {
  const preset = opts.preset ? DEVICE_PRESETS[String(opts.preset).toLowerCase()] : null;
  if (!preset) return;

  opts.device = opts.device || preset.device;
  opts.width = opts.width || preset.width;
  opts.height = opts.height || preset.height;
}

function browserOptionArgs(opts) {
  const args = [];
  if (opts.headed) args.push('--headed');
  if (opts.provider) args.push('--provider', opts.provider);
  if (opts.device) args.push('--device', opts.device);
  if (opts.colorScheme) args.push('--color-scheme', opts.colorScheme);
  return args;
}

function applyPageOptions(opts) {
  const width = parsePositiveInteger(opts.width);
  const height = parsePositiveInteger(opts.height);

  if (opts.device) run(['set', 'device', opts.device], { silent: true });
  if (opts.colorScheme === 'dark' || opts.colorScheme === 'light') run(['set', 'media', opts.colorScheme], { silent: true });
  if (width !== undefined && height !== undefined) run(['set', 'viewport', String(width), String(height)], { silent: true });
}

function cmdOpen(url, opts) {
  const openArgs = [...browserOptionArgs(opts), 'open', url];

  writeStderr(`opening ${url}...`);
  const open = run(openArgs);
  if (!open.ok) { writeStdout(`error: ${open.stderr}`); return; }

  applyPageOptions(opts);

  writeStderr('waiting for page load...');
  run(['wait', '--load', 'networkidle'], { silent: true });

  writeStderr('taking snapshot...');
  const snap = run(['snapshot', '-i'], { silent: true });

  ensureScreenshotDir();
  const ssPath = screenshotPath(new URL(url).hostname);
  writeStderr(`taking screenshot → ${ssPath}`);
  const ss = run(['screenshot', ssPath, ...(opts.full ? ['--full'] : [])], { silent: true });

  // get page info
  const title = run(['get', 'title'], { silent: true });
  const pageUrl = run(['get', 'url'], { silent: true });

  writeStdout('');
  writeStdout(`url: ${pageUrl.stdout}`);
  writeStdout(`title: ${title.stdout}`);
  writeStdout(`screenshot: ${ssPath}`);
  writeStdout(`browser: ${describeBrowserOptions(opts)}`);
  writeStdout('');
  writeStdout('--- interactive elements ---');
  writeStdout(snap.stdout);
}

function describeBrowserOptions(opts) {
  const parts = [];
  if (opts.preset) parts.push(`preset=${opts.preset}`);
  if (opts.provider) parts.push(`provider=${opts.provider}`);
  if (opts.device) parts.push(`device=${opts.device}`);
  if (opts.width && opts.height) parts.push(`viewport=${opts.width}x${opts.height}`);
  if (opts.colorScheme) parts.push(`colorScheme=${opts.colorScheme}`);
  return parts.length > 0 ? parts.join(' ') : 'default';
}

function cmdScreenshot(name, opts) {
  ensureScreenshotDir();
  applyPageOptions(opts);
  const ssPath = screenshotPath(name);
  const args = ['screenshot', ssPath];
  if (opts.full) args.push('--full');
  const result = run(args);
  if (result.ok) {
    writeStdout(`screenshot: ${ssPath}`);
    writeStdout(`browser: ${describeBrowserOptions(opts)}`);
  } else {
    writeStdout(`error: ${result.stderr}`);
  }
}

function cmdSnap() {
  const result = run(['snapshot', '-i']);
  writeStdout(result.stdout);
}

function cmdClick(ref) {
  const result = run(['click', ref]);
  if (result.ok) {
    writeStdout(`clicked ${ref}`);
    // auto-snapshot after click so agent sees the new state
    writeStderr('auto-snapshot after click...');
    run(['wait', '500'], { silent: true });
    const snap = run(['snapshot', '-i'], { silent: true });
    writeStdout('');
    writeStdout('--- updated elements ---');
    writeStdout(snap.stdout);
  } else {
    writeStdout(`error clicking ${ref}: ${result.stderr}`);
  }
}

function cmdFill(ref, text) {
  const result = run(['fill', ref, text]);
  if (result.ok) {
    writeStdout(`filled ${ref} with "${text}"`);
  } else {
    writeStdout(`error filling ${ref}: ${result.stderr}`);
  }
}

function loginArgs(name, opts) {
  const args = [];
  if (opts.headed) args.push('--headed');
  args.push('auth', 'login', name);
  return args;
}

function cmdLogin(name = 'consuelo', opts = {}) {
  const result = run(loginArgs(name, opts));
  if (result.ok) {
    writeStdout(`logged in as ${name}`);
  } else {
    writeStdout(`error: ${result.stderr}`);
  }
}

function cmdReauth(name = 'consuelo', opts = {}) {
  writeStderr('closing browser daemon so profile flags apply...');
  run(['close', '--all'], { silent: true, useProfile: false });

  const result = run(loginArgs(name, opts));
  if (result.ok) {
    writeStdout(`reauth complete for ${name}`);
  } else {
    writeStdout(`error: ${result.stderr}`);
  }
}

function cmdEval(js) {
  const result = run(['eval', js]);
  writeStdout(result.stdout);
}

function cmdRaw(args) {
  const result = run(args);
  if (result.stdout) writeStdout(result.stdout);
  if (result.stderr && !result.ok) writeStdout(`error: ${result.stderr}`);
}

// noise patterns to filter from network request output
const NETWORK_NOISE = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)|^data:|\/webpack|\/hot-update|\/socket\.io|\/ws$|__nextjs|_next\/static|chrome-extension/i;

function cmdNetwork(argv) {
  // "network requests" gets special filtering; everything else passes through
  const sub = argv[1];
  if (sub !== 'requests') {
    cmdRaw(argv);
    return;
  }

  // bump timeout for network requests — can be slow
  const networkArgs = withProfile(argv);
  const result = spawnSync('agent-browser', networkArgs, {
    encoding: 'utf8',
    timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = (result.stdout || '').trim();

  if (!stdout) {
    writeStdout('no network requests captured');
    return;
  }

  // if --json flag was passed, try to parse and filter as json
  if (argv.includes('--json')) {
    try {
      const requests = JSON.parse(stdout);
      const filtered = requests.filter((r) => !NETWORK_NOISE.test(r.url || r.path || ''));
      writeStdout(JSON.stringify(filtered, null, 2));
      return;
    } catch {
      // not valid json, fall through to line filtering
    }
  }

  // line-by-line filtering for text output
  const lines = stdout.split('\n').filter((l) => {
    if (!l.trim()) return false;
    // keep header/separator lines
    if (l.startsWith('─') || l.startsWith('│') || l.startsWith('┌') || l.startsWith('└') || l.startsWith('├')) return true;
    // filter noise urls
    return !NETWORK_NOISE.test(l);
  });

  if (lines.length === 0) {
    writeStdout('no meaningful network requests (all filtered as static assets)');
    return;
  }

  writeStdout(lines.join('\n'));
}

// simple passthrough commands that just forward args to agent-browser
function cmdPassthrough(abCommand, args) {
  const result = run([abCommand, ...args]);
  if (result.stdout) writeStdout(result.stdout);
  if (!result.ok && result.stderr) writeStdout(`error: ${result.stderr}`);
}

// interaction commands that auto-snapshot after
function cmdInteract(abCommand, args) {
  const result = run([abCommand, ...args]);
  if (result.ok) {
    writeStdout(`${abCommand} ${args.join(' ')}: ok`);
    run(['wait', '500'], { silent: true });
    const snap = run(['snapshot', '-i'], { silent: true });
    writeStdout('');
    writeStdout('--- updated elements ---');
    writeStdout(snap.stdout);
  } else {
    writeStdout(`error: ${result.stderr}`);
  }
}

function cmdWait(argv) {
  // pass everything after 'wait' straight through
  const args = argv.slice(1);
  const result = run(['wait', ...args]);
  if (result.ok) {
    writeStdout('wait complete');
  } else {
    writeStdout(`error: ${result.stderr}`);
  }
}

function cmdFind(argv) {
  // pass everything after 'find' straight through
  const args = argv.slice(1);
  const result = run(['find', ...args]);
  if (result.stdout) writeStdout(result.stdout);
  if (!result.ok && result.stderr) writeStdout(`error: ${result.stderr}`);
}

function cmdGet(argv) {
  const [, target, ...rest] = argv;
  const normalizedTarget = target === 'attribute' ? 'attr' : target;
  const args = ['get'];
  if (normalizedTarget) args.push(normalizedTarget);
  args.push(...rest);
  const result = run(args);
  if (result.stdout) writeStdout(result.stdout);
  if (!result.ok && result.stderr) writeStdout(`error: ${result.stderr}`);
}

function cmdBatch(argv) {
  // pass everything after 'batch' straight through
  const args = argv.slice(1);
  const result = run(['batch', ...args], { silent: false });
  if (result.stdout) writeStdout(result.stdout);
  if (!result.ok && result.stderr) writeStdout(`error: ${result.stderr}`);
}

function cmdTabs(argv) {
  const action = argv[1];
  const parts = argv.slice(2);
  const labelIndex = parts.indexOf('--label');
  const label = labelIndex >= 0 ? parts[labelIndex + 1] : null;
  const partsWithoutLabel = labelIndex >= 0
    ? parts.filter((_, index) => index !== labelIndex && index !== labelIndex + 1)
    : parts;
  const positional = partsWithoutLabel.filter((part) => !part.startsWith('-'));

  if (!action || action === 'list') {
    cmdRaw(['tab', ...partsWithoutLabel]);
    return;
  }

  if (action === 'new') {
    const args = ['tab', 'new'];
    const destination = positional.at(-1);
    const destinationIndex = destination === undefined ? -1 : partsWithoutLabel.lastIndexOf(destination);
    const forwardedParts = partsWithoutLabel.filter((_, index) => index !== destinationIndex);
    if (label) args.push('--label', label);
    args.push(...forwardedParts);
    if (destination) args.push(destination);
    cmdRaw(args);
    return;
  }

  if (action === 'select' || action === 'switch') {
    const target = positional[0];
    if (!target) {
      writeStdout('error: target tab id or label required');
      return;
    }
    cmdRaw(['tab', target]);
    return;
  }

  if (action === 'close') {
    const args = ['tab', 'close'];
    if (positional[0]) args.push(positional[0]);
    cmdRaw(args);
    return;
  }

  cmdRaw(['tab', action, ...partsWithoutLabel]);
}

function cmdCookies(argv) {
  const [, action, name, value] = argv;
  if (!action || action === 'list') {
    cmdRaw(['cookies']);
    return;
  }

  const args = ['cookies', action];
  if (name !== undefined) args.push(name);
  if (value !== undefined) args.push(value);
  cmdRaw(args);
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    printHelp();
    return;
  }

  const command = argv[0];

  // raw and network get the full argv (including flags) passed through
  if (command === 'raw') {
    const rawArgs = argv.slice(1);
    if (rawArgs.length === 0 || (rawArgs.length === 1 && rawArgs[0] === '--help')) {
      // pass --help to agent-browser itself
      cmdRaw(rawArgs.length === 0 ? ['--help'] : rawArgs);
      return;
    }
    cmdRaw(rawArgs);
    return;
  }

  if (command === 'network') {
    cmdNetwork(argv);
    return;
  }

  // for everything else, check --help and extract opts
  if (argv.includes('--help')) {
    printHelp();
    return;
  }

  const { opts, args } = parseOptions(argv);

  switch (command) {
    case 'open':
    case 'url':
      if (!args[1]) { writeStdout('error: url required. usage: bun run browser -- open <url>'); return; }
      cmdOpen(args[1], opts);
      break;
    case 'consuelo':
      cmdOpen(CONSUELO_URL, opts);
      break;
    case 'app':
      cmdOpen(APP_URL, opts);
      break;
    case 'screenshot':
    case 'ss':
      cmdScreenshot(args[1], opts);
      break;
    case 'snap':
    case 'snapshot':
      cmdSnap();
      break;
    case 'click':
      cmdClick(args[1]);
      break;
    case 'dblclick':
      cmdInteract('dblclick', [args[1]]);
      break;
    case 'fill':
      cmdFill(args[1], args.slice(2).join(' '));
      break;
    case 'type':
      cmdPassthrough('type', [args[1], args.slice(2).join(' ')]);
      break;
    case 'hover':
      cmdPassthrough('hover', [args[1]]);
      break;
    case 'select':
      cmdInteract('select', [args[1], args[2]]);
      break;
    case 'check':
      cmdInteract('check', [args[1]]);
      break;
    case 'uncheck':
      cmdInteract('uncheck', [args[1]]);
      break;
    case 'scroll':
      cmdPassthrough('scroll', args.slice(1));
      break;
    case 'login':
      cmdLogin(args[1], opts);
      break;
    case 'reauth':
    case 'refresh-auth':
      cmdReauth(args[1], opts);
      break;
    case 'eval':
      cmdEval(args.slice(1).join(' '));
      break;
    case 'get':
      cmdGet(argv);
      break;
    case 'close':
      run(['close', '--all'], { useProfile: false }); writeStdout('browser closed'); break;

    // wait / find / batch — pass full argv for flag handling
    case 'wait':
      cmdWait(argv);
      break;
    case 'find':
      cmdFind(argv);
      break;
    case 'batch':
      cmdBatch(argv);
      break;

    // tab management
    case 'tab':
      cmdRaw(argv);
      break;
    case 'tabs':
      cmdTabs(argv);
      break;

    // cookies / storage
    case 'cookies':
      cmdCookies(argv);
      break;
    case 'storage':
      cmdRaw(argv);
      break;

    // debug
    case 'console':
      cmdRaw(argv);
      break;
    case 'errors':
      cmdRaw(argv);
      break;

    // download / clipboard
    case 'download':
      cmdRaw(argv);
      break;
    case 'clipboard':
      cmdRaw(argv);
      break;

    // settings
    case 'set':
      cmdRaw(argv);
      break;

    // dialogs
    case 'dialog':
      cmdRaw(argv);
      break;

    default:
      // pass through to agent-browser directly
      cmdRaw(argv);
      break;
  }
}

main();
