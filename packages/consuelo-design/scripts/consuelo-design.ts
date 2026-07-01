#!/usr/bin/env bun

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(currentFile), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const workspaceScript = path.join(repoRoot, 'packages/workspace/scripts/office.ts');

const child = Bun.spawn(['bun', workspaceScript, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});

process.exit(await child.exited);
