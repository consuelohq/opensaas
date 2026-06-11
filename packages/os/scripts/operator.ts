#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cwdOperator = path.resolve(process.cwd(), 'operator/operator.ts');
const packageOperator = path.resolve(scriptDir, '..', 'operator', 'operator.ts');
const target = fs.existsSync(cwdOperator) ? cwdOperator : packageOperator;

if (!fs.existsSync(target)) {
  process.stderr.write(`operator prompt runner not found: ${target}\n`);
  process.exit(1);
}

const result = spawnSync('bun', [target, ...Bun.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);