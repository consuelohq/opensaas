#!/usr/bin/env bun

// browser.js — agent-friendly browser automation wrapper
// uses agent-browser with a persistent local profile when configured
// usage: bun run browser -- <command> [options]

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROFILE = process.env.AGENT_BROWSER_PROFILE
  || path.join(os.homedir(), '.agent-browser-ko');
const SCREENSHOT_DIR = process.env.AGENT_SCREENSHOT_DIR
  || path.join(os.tmpdir(), 'opensaas-screenshots');
const CONSUELO_URL = process.env.AGENT_CONSUELO_URL
  || 'https://consuelo.consuelohq.com';
const APP_URL = process.env.AGENT_APP_URL
  || 'https://app.consuelohq.com';

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function printHelp() {
  const lines = [
    'usage: bun run browser -- <command> [options]',
    '',
    'agent-friendly browser wrapper with a persistent auth profile.',
    `screenshots go to ${SCREENSHOT_DIR}.`,
    '',
    'commands:',
    '  open|url <url>       open url, wait for load, snapshot, screenshot',
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
    'set AGENT_BROWSER_PROFILE, AGENT_SCREENSHOT_DIR, AGENT_CONSUELO_URL, or AGENT_APP_URL to override defaults.',
    '',
    'options:',
    '  --headed             show browser window (visible to ko)',
    '  --full               full page screenshot',
    '  --json               json output',
    '  --help               show this help',
  ];
  lines.forEach((l) => writeStdout(l));
}
function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
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

function cmdOpen(url, opts) {
  const openArgs = [];
  if (opts.headed) openArgs.push('--headed');
  openArgs.push('open', url);

  writeStderr(`opening ${url}...`);
  const open = run(openArgs);
  if (!open.ok) { writeStdout(`error: ${open.stderr}`); return; }

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
  writeStdout('');
  writeStdout('--- interactive elements ---');
  writeStdout(snap.stdout);
}

function cmdScreenshot(name, opts) {
  ensureScreenshotDir();
  const ssPath = screenshotPath(name);
  const args = ['screenshot', ssPath];
  if (opts.full) args.push('--full');
  const result = run(args);
  if (result.ok) {
    writeStdout(`screenshot: ${ssPath}`);
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

function cmdBatch(argv) {
  // pass everything after 'batch' straight through
  const args = argv.slice(1);
  const result = run(['batch', ...args], { silent: false });
  if (result.stdout) writeStdout(result.stdout);
  if (!result.ok && result.stderr) writeStdout(`error: ${result.stderr}`);
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

  // extract global opts
  const opts = {
    headed: argv.includes('--headed'),
    full: argv.includes('--full'),
    json: argv.includes('--json'),
  };
  const args = argv.filter((a) => !a.startsWith('--'));

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

    // cookies / storage
    case 'cookies':
      cmdRaw(argv);
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
