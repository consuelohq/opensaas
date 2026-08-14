#!/usr/bin/env bun

import { runSecurityScan } from './lib/security-scan-runner';

function main(): void {
  try {
    const report = runSecurityScan();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error: { code: 'SECURITY_SCAN_FAILED', message },
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main();
