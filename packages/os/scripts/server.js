#!/usr/bin/env node
// server.js — manage the workspace MCP server
// supports both launchd and direct process modes
const { execSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const LABEL = 'com.consuelo.workspace';
const PLIST = `${process.env.HOME}/Library/LaunchAgents/${LABEL}.plist`;
const HEALTH = 'http://localhost:8850/health';
const WORKSPACE_DIR = path.resolve(__dirname, '..');
const START_SCRIPT = path.join(WORKSPACE_DIR, 'scripts', 'start-brain.sh');
const SERVER_PY = path.join(WORKSPACE_DIR, 'server.py');
const LOG_FILE = '/tmp/workspace.log';

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 10000 }).trim(); }
  catch (e) { return e.stdout?.trim() || e.message; }
}

function health() {
  try {
    const r = run(`curl -sf ${HEALTH}`);
    return JSON.parse(r);
  } catch { return null; }
}

function isLaunchdLoaded() {
  const out = run(`launchctl list ${LABEL} 2>/dev/null`);
  return out.includes('PID') || out.includes(LABEL);
}

function findServerPid() {
  const pid = run('pgrep -f "workspace/server.py"');
  return pid && /^\d+$/.test(pid) ? pid : null;
}

function killServer() {
  // kill by pid AND by port to catch stale processes
  const pid = findServerPid();
  const portPid = run('lsof -iTCP:8850 -sTCP:LISTEN -t 2>/dev/null');
  const pids = new Set([pid, portPid].filter(p => p && /^\d+$/.test(p)));

  for (const p of pids) {
    run(`kill ${p}`);
  }
  for (let i = 0; i < 10; i++) {
    if (!findServerPid() && !run('lsof -iTCP:8850 -sTCP:LISTEN -t 2>/dev/null').match(/^\d+$/)) return true;
    run('sleep 0.3');
  }
  for (const p of pids) {
    run(`kill -9 ${p}`);
  }
  return !findServerPid();
}

function startDirect() {
  if (existsSync(START_SCRIPT)) {
    spawn('bash', [START_SCRIPT], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      cwd: WORKSPACE_DIR,
    }).unref();
  } else {
    // fallback: start server.py directly with .env
    const envFile = path.join(WORKSPACE_DIR, '.env');
    const env = { ...process.env };
    if (existsSync(envFile)) {
      const content = require('fs').readFileSync(envFile, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Z_]+)=(.+)/);
        if (match) env[match[1]] = match[2].trim();
      }
    }
    const python = path.join(WORKSPACE_DIR, '.venv', 'bin', 'python');
    const pythonBin = existsSync(python) ? python : 'python3';
    spawn(pythonBin, [SERVER_PY], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      cwd: WORKSPACE_DIR,
      env,
    }).unref();
  }
}

function waitForHealth(label) {
  for (let i = 0; i < 15; i++) {
    const h = health();
    if (h) {
      console.log(`✓ ${label} — ${h.tools} tools, name: ${h.name}`);
      const pid = findServerPid();
      if (pid) console.log(`  pid: ${pid}`);
      return true;
    }
    run('sleep 0.5');
  }
  console.log(`${label} (health check pending — server may still be starting)`);
  return false;
}

// --- main ---

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('usage: bun run server -- [restart|status|stop|start|logs]');
  console.log('');
  console.log('  restart   stop + start the workspace MCP server (default)');
  console.log('  status    show server health and process info');
  console.log('  stop      stop the server');
  console.log('  start     start the server');
  console.log('  logs      tail server logs');
  console.log('');
  console.log('uses launchd if the agent is loaded, otherwise manages the process directly.');
  process.exit(0);
}

const cmd = args[0] || 'restart';
const useLaunchd = isLaunchdLoaded();

switch (cmd) {
  case 'status': {
    const h = health();
    if (h) {
      console.log(`✓ server running — ${h.tools} tools, name: ${h.name}`);
      const pid = findServerPid();
      if (pid) console.log(`  pid: ${pid}`);
      console.log(`  mode: ${useLaunchd ? 'launchd' : 'direct'}`);
    } else {
      console.log('✗ server not responding');
      const pid = findServerPid();
      if (pid) console.log(`  process exists (pid ${pid}) but not healthy`);
    }
    break;
  }

  case 'stop':
    if (useLaunchd) {
      run(`launchctl unload ${PLIST} 2>/dev/null`);
    }
    killServer();
    console.log('stopped');
    break;

  case 'start':
    if (findServerPid()) {
      console.log('server already running');
      const h = health();
      if (h) console.log(`  ✓ healthy — ${h.tools} tools`);
      else console.log('  ✗ process exists but not healthy');
      break;
    }
    if (useLaunchd) {
      run(`launchctl load ${PLIST} 2>/dev/null`);
    } else {
      startDirect();
    }
    waitForHealth('started');
    break;

  case 'restart':
    if (useLaunchd) {
      run(`launchctl unload ${PLIST} 2>/dev/null`);
      run('sleep 1');
      run(`launchctl load ${PLIST} 2>/dev/null`);
    } else {
      killServer();
      run('sleep 1');
      startDirect();
    }
    waitForHealth('restarted');
    break;

  case 'logs':
    try {
      execSync(`tail -50 ${LOG_FILE}`, { stdio: 'inherit' });
    } catch { console.log(`no logs at ${LOG_FILE}`); }
    break;

  default:
    console.error(`unknown command: ${cmd}`);
    process.exit(1);
}
