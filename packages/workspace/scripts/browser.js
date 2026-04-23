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
    '  open <url>           open url, wait for load, snapshot, screenshot',
    '  consuelo             open consuelo.consuelohq.com (internal CRM)',
    '  app                  open app.consuelohq.com (production)',
    '  screenshot [name]    take screenshot of current page',
    '  snap                 snapshot current page (accessibility tree)',
    '  click <ref>          click element by ref (@e1, @e2, etc.)',
    '  fill <ref> <text>    fill input by ref',
    '  login <name>         run saved auth login',
    '  eval <js>            run javascript on current page',
    '  close                close the browser
    raw <...args>        pass args directly to agent-browser',
    '',
    'options:',
    '  --headed             show browser window (visible to ko)',
    '  --full               full page screenshot',
    '  --json               json output',
    '  --help               show this help',
    '',
    'examples:',
    '  bun run browser -- open https://example.com',
    '  bun run browser -- consuelo --headed',
    '  bun run browser -- snap',
    '  bun run browser -- click @e5',
    '  bun run browser -- fill @e3 "search query"',
    '  bun run browser -- screenshot after-login',
    '  bun run browser -- eval "document.title"',
  ];
  lines.forEach((l) => writeStdout(l));
}

function ensureScreenshotDir() {
  try { execSync(`mkdir -p ${SCREENSHOT_DIR}`, { encoding: 'utf8' }); } catch {}
}

function run(args, { silent = false } = {}) {
  const cmd = ['agent-browser', ...args].join(' ');
  if (!silent) writeStderr(`> ${cmd}`);
  const result = spawnSync('agent-browser', args, {
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
  const openArgs = ['open', url];
  if (opts.headed) openArgs.push('--headed');

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

function cmdLogin(name) {
  const result = run(['auth', 'login', name]);
  if (result.ok) {
    writeStdout(`logged in as ${name}`);
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

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes('--help')) {
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

  const command = args[0];

  switch (command) {
    case 'open':
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
    case 'fill':
      cmdFill(args[1], args.slice(2).join(' '));
      break;
    case 'login':
      cmdLogin(args[1]);
      break;
    case 'eval':
      cmdEval(args.slice(1).join(' '));
      break;
    case 'close':
      run(['close']); writeStdout('browser closed'); break;
    case 'raw':
      cmdRaw(args.slice(1));
      break;
    default:
      // pass through to agent-browser directly
      cmdRaw(args);
      break;
  }
}

main();
