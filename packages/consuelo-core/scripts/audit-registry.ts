#!/usr/bin/env bun

import { runRegistryAudit } from '../src/registry/index';

function printTextReport(report: ReturnType<typeof runRegistryAudit>): void {
  process.stdout.write(`registry audit: ${report.ok ? 'ok' : 'failed'}\n`);
  process.stdout.write(
    `entries: packages=${report.registry.packages} scripts=${report.registry.scripts} tools=${report.registry.tools} skills=${report.registry.skills}\n`,
  );
  process.stdout.write(`drift duplicates: ${report.drift.duplicates.length}\n`);

  for (const issue of report.issues) {
    process.stdout.write(`${issue.code}: ${issue.path} - ${issue.message}\n`);
  }
}

const args = new Set(process.argv.slice(2));
const report = runRegistryAudit({ driftOnly: args.has('--drift') });

if (args.has('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  printTextReport(report);
}

if (!report.ok) {
  process.exitCode = 1;
}
