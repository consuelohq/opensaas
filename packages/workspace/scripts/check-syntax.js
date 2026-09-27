#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const scriptsDir = path.resolve(__dirname);
const failures = [];
const NODE_EXECUTABLE = process.env.NODE_BIN || (process.versions.bun ? 'node' : process.execPath);
const SYNTAX_CHECK_TIMEOUT_MS = Math.max(1000, Number(process.env.CONSUELO_SYNTAX_CHECK_TIMEOUT_MS || 10000));

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    const result = spawnSync(NODE_EXECUTABLE, ['--check', fullPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: SYNTAX_CHECK_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });

    if (result.status !== 0 || result.error) {
      failures.push({
        file: path.relative(process.cwd(), fullPath).split(path.sep).join('/'),
        message: result.stderr || result.stdout || (result.error && result.error.message) || 'node --check failed',
      });
    }
  }
}

const requestedFiles = process.argv.slice(2);
if (requestedFiles.length > 0) {
  for (const requestedFile of requestedFiles) {
    const fullPath = path.resolve(requestedFile);
    const result = spawnSync(NODE_EXECUTABLE, ['--check', fullPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: SYNTAX_CHECK_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
    if (result.status !== 0 || result.error) {
      failures.push({
        file: path.relative(process.cwd(), fullPath).split(path.sep).join('/'),
        message: result.stderr || result.stdout || (result.error && result.error.message) || 'node --check failed',
      });
    }
  }
} else {
  walk(scriptsDir);
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(failure.file + '\n' + failure.message + '\n');
  }
  process.exit(1);
}

process.stdout.write('workspace script syntax checks passed\n');
