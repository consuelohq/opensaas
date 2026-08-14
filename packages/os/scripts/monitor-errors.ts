#!/usr/bin/env bun

import { buildMonitorErrorsReport } from './lib/monitor-errors-report';

function main(): void {
  try {
    const report = buildMonitorErrorsReport();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error: { code: 'MONITOR_ERRORS_FAILED', message },
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main();
