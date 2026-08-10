#!/usr/bin/env node

import { existsSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';

const entryUrl = new URL('../dist/cli.cjs', import.meta.url);

if (!existsSync(entryUrl)) {
  process.stderr.write(
    'The Twenty SDK CLI has not been built. Run `yarn nx build twenty-sdk` before invoking this workspace binary.\n',
  );
  process.exitCode = 1;
} else {
  await import(entryUrl.href);
}
