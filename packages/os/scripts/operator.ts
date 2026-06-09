#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwdOperator = path.resolve(process.cwd(), 'operator/operator.ts');
const repoOperator = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..', 'operator/operator.ts');
const target = fs.existsSync(cwdOperator) ? cwdOperator : repoOperator;

if (!fs.existsSync(target)) {
  process.stderr.write(`operator prompt runner not found: ${target}\n`);
  process.exit(1);
}

const result = spawnSync('bun', [target, ...Bun.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
