#!/usr/bin/env node
'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LABEL = 'com.consuelo.os';
const WORKSPACE_DIR = path.resolve(__dirname, '..');
const PORT = process.env.CONSUELO_OS_PORT || process.env.PORT || '8960';
const HEALTH = `http://127.0.0.1:${PORT}/health`;
const SERVER_TS = path.join(WORKSPACE_DIR, 'scripts', 'server.ts');
const LOG_FILE = path.join(process.env.CONSUELO_HOME || path.join(process.env.HOME || '/tmp', '.consuelo', 'os'), 'logs', 'server.log');


function writeLine(message = '') {
  process.stdout.write(`${message}\n`);
}

function writeError(message) {
  process.stderr.write(`${message}\n`);
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 10000 }).trim();
  } catch (error) {
    return error.stdout?.trim() || error.message;
  }
}

function loadEnvFile() {
  const envFile = path.join(WORKSPACE_DIR, '.env');
  const env = { ...process.env, CONSUELO_OS_PORT: PORT };
  if (!fs.existsSync(envFile)) return env;

  const content = fs.readFileSync(envFile, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function health() {
  try {
    const response = run(`curl -sf ${HEALTH}`);
    return JSON.parse(response);
  } catch {
    return null;
  }
}

function findServerPid() {
  const pid = run(`pgrep -f "packages/os/scripts/server.ts|${SERVER_TS}"`);
  return pid && /^\d+$/.test(pid) ? pid : null;
}

function findPortPid() {
  const pid = run(`lsof -iTCP:${PORT} -sTCP:LISTEN -t 2>/dev/null`);
  return pid && /^\d+$/.test(pid) ? pid : null;
}

function killServer() {
  const pids = new Set([findServerPid(), findPortPid()].filter((pid) => pid && /^\d+$/.test(pid)));
  for (const pid of pids) run(`kill ${pid}`);

  for (let i = 0; i < 10; i += 1) {
    if (!findServerPid() && !findPortPid()) return true;
    run('sleep 0.3');
  }

  for (const pid of pids) run(`kill -9 ${pid}`);
  return !findServerPid() && !findPortPid();
}

function startDirect() {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  const log = fs.openSync(LOG_FILE, 'a');
  spawn('bun', [SERVER_TS], {
    detached: true,
    stdio: ['ignore', log, log],
    cwd: WORKSPACE_DIR,
    env: loadEnvFile(),
  }).unref();
}

function waitForHealth(label) {
  for (let i = 0; i < 15; i += 1) {
    const response = health();
    if (response) {
      writeLine(`✓ ${label} — ${response.runtime} runtime, ${response.tools} tools, name: ${response.name}`);
      const pid = findServerPid() || findPortPid();
      if (pid) writeLine(`  pid: ${pid}`);
      writeLine(`  health: ${HEALTH}`);
      return true;
    }
    run('sleep 0.5');
  }
  writeLine(`${label} (health check pending — server may still be starting)`);
  return false;
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  writeLine('usage: bun run server -- [restart|status|stop|start|logs]');
  writeLine('');
  writeLine('  restart   stop + start the Consuelo OS server (default)');
  writeLine('  status    show server health and process info');
  writeLine('  stop      stop the server');
  writeLine('  start     start the server');
  writeLine('  logs      tail server logs');
  writeLine('');
  writeLine(`default health URL: ${HEALTH}`);
  process.exit(0);
}

const cmd = args[0] || 'restart';

switch (cmd) {
  case 'status': {
    const response = health();
    if (response) {
      writeLine(`✓ server running — ${response.runtime} runtime, ${response.tools} tools, name: ${response.name}`);
      const pid = findServerPid() || findPortPid();
      if (pid) writeLine(`  pid: ${pid}`);
      writeLine(`  health: ${HEALTH}`);
    } else {
      writeLine('✗ server not responding');
      const pid = findServerPid() || findPortPid();
      if (pid) writeLine(`  process exists (pid ${pid}) but not healthy`);
    }
    break;
  }

  case 'stop':
    killServer();
    writeLine('stopped');
    break;

  case 'start':
    if (findServerPid() || findPortPid()) {
      writeLine('server already running');
      const response = health();
      if (response) writeLine(`  ✓ healthy — ${response.runtime} runtime, ${response.tools} tools`);
      else writeLine('  ✗ process exists but not healthy');
      break;
    }
    startDirect();
    waitForHealth('started');
    break;

  case 'restart':
    killServer();
    run('sleep 1');
    startDirect();
    waitForHealth('restarted');
    break;

  case 'logs':
    try {
      execSync(`tail -50 ${LOG_FILE}`, { stdio: 'inherit' });
    } catch {
      writeLine(`no logs at ${LOG_FILE}`);
    }
    break;

  default:
    writeError(`unknown command: ${cmd}`);
    process.exit(1);
}
