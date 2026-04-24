#!/usr/bin/env node
// restart the workspace MCP server (launchd daemon)
const { execSync } = require('child_process');

const LABEL = 'com.consuelo.workspace';
const PLIST = `${process.env.HOME}/Library/LaunchAgents/${LABEL}.plist`;
const HEALTH = 'http://localhost:8850/health';

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

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('usage: bun run server -- [restart|status|stop|start|logs]');
  console.log('');
  console.log('  restart   stop + start the workspace MCP server (default)');
  console.log('  status    show server health and process info');
  console.log('  stop      stop the server');
  console.log('  start     start the server');
  console.log('  logs      tail server logs');
  process.exit(0);
}

const cmd = args[0] || 'restart';

switch (cmd) {
  case 'status': {
    const h = health();
    if (h) {
      console.log(`✓ server running — ${h.tools} tools, name: ${h.name}`);
      const pid = run(`pgrep -f "workspace/server.py"`);
      if (pid) console.log(`  pid: ${pid}`);
    } else {
      console.log('✗ server not responding');
    }
    break;
  }
  case 'stop':
    run(`launchctl unload ${PLIST}`);
    console.log('stopped');
    break;
  case 'start':
    run(`launchctl load ${PLIST}`);
    // wait for health
    for (let i = 0; i < 10; i++) {
      const h = health();
      if (h) { console.log(`✓ started — ${h.tools} tools`); process.exit(0); }
      run('sleep 0.5');
    }
    console.log('started (health check pending)');
    break;
  case 'restart':
    run(`launchctl unload ${PLIST}`);
    run('sleep 1');
    run(`launchctl load ${PLIST}`);
    // wait for health
    for (let i = 0; i < 10; i++) {
      const h = health();
      if (h) { console.log(`✓ restarted — ${h.tools} tools`); process.exit(0); }
      run('sleep 0.5');
    }
    console.log('restarted (health check pending)');
    break;
  case 'logs':
    try {
      execSync('tail -50 /tmp/workspace.log', { stdio: 'inherit' });
    } catch { console.log('no logs at /tmp/workspace.log'); }
    break;
  default:
    console.error(`unknown command: ${cmd}`);
    process.exit(1);
}
