#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const WORKSPACE_DIR = path.resolve(__dirname, '..');
const PORT = process.env.CONSUELO_OS_PORT || process.env.PORT || '46321';
const LIFECYCLE_TS = path.join(WORKSPACE_DIR, 'scripts', 'lifecycle.ts');
const RELOAD_JS = path.join(WORKSPACE_DIR, 'scripts', 'consuelo-reload.js');

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: WORKSPACE_DIR,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  process.stdout.write([
    'usage: bun run server -- [restart|status|stop|start|logs]',
    '',
    'restart delegates to the unified lifecycle engine.',
    'status, stop, start, and logs delegate to the canonical reload adapter.',
    `default health URL: http://127.0.0.1:${PORT}/health`,
    '',
  ].join('\n'));
} else {
  const command = args[0] || 'restart';
  if (command === 'restart') run(LIFECYCLE_TS, ['restart', ...args.slice(1)]);
  else if (['status', 'stop', 'start', 'logs'].includes(command)) {
    run(RELOAD_JS, [command, ...args.slice(1)]);
  } else {
    process.stderr.write(`unknown command: ${command}\n`);
    process.exitCode = 1;
  }
}
