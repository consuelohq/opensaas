#!/usr/bin/env bun
import { runBoundedQaProcess } from '../src/lab/bounded-qa-process';
/**
 * Deterministic carrier-free acceptance runner and sanitized human evidence journal.
 * The run command invokes allowlisted local Bun tests, not telephony endpoints.
 * The record command accepts human observations without certifying actual calls.
 */
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import {
  createLaunchEvidence,
  formatLaunchReport,
  launchScenarios,
  resolveScenarioSelection,
  sanitizeDiagnosticValue,
  type EvidenceOutcome,
  type LaunchEvidence,
} from '../src/lab/launch-scenarios';

const repoRoot = resolve(import.meta.dir, '../../..');
const evidenceDirectory = process.env.CONSUELO_LAUNCH_QA_EVIDENCE_DIR
  ? resolve(process.env.CONSUELO_LAUNCH_QA_EVIDENCE_DIR)
  : join(homedir(), '.consuelo', 'dialer-launch-qa');
const argv = process.argv.slice(2);
const command = argv[0] ?? 'help';
// A command-line interface writes operator-facing output to stdout/stderr,
// rather than to the application server's structured telemetry stream.
const cli = {
  log: (...lines: unknown[]) =>
    process.stdout.write(lines.map(String).join(' ') + '\n'),
  warn: (...lines: unknown[]) =>
    process.stderr.write(lines.map(String).join(' ') + '\n'),
};

const option = (flag: string): string | undefined => {
  const index = argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(flag + ' needs a value');
  return value;
};
const required = (flag: string): string => {
  const value = option(flag);
  if (!value) throw new Error('Missing ' + flag);
  return value;
};

async function saveEvidence(evidence: LaunchEvidence): Promise<string> {
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  const name =
    evidence.scenarioId +
    '-' +
    evidence.lane +
    '-' +
    evidence.timestamp.replace(/[:.]/g, '-') +
    '-' +
    evidence.runId +
    '.json';
  const output = join(evidenceDirectory, name);
  await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  return output;
}

async function loadEvidence(): Promise<LaunchEvidence[]> {
  const files = await readdir(evidenceDirectory).catch((error: unknown) => {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return [];
    throw error;
  });
  const records: LaunchEvidence[] = [];
  for (const filename of files
    .filter((name) => /^S\d{2}-.*\.json$/.test(name))
    .sort()) {
    try {
      const data = JSON.parse(
        await readFile(join(evidenceDirectory, filename), 'utf8'),
      ) as LaunchEvidence;
      resolveScenarioSelection(data.scenarioId);
      if (data.lane !== 'automated' && data.lane !== 'manual')
        throw new Error('Unsupported evidence lane');
      if (!['passed', 'failed', 'blocked'].includes(data.outcome))
        throw new Error('Unsupported evidence outcome');
      records.push(data);
    } catch (error: unknown) {
      throw new Error(
        'Invalid evidence file ' + filename + '; preserve for investigation',
        { cause: error },
      );
    }
  }
  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function show(scenarioId: string) {
  const scenarios = resolveScenarioSelection(scenarioId);
  for (const scenario of scenarios) {
    cli.log('\n' + scenario.id + ' — ' + scenario.title);
    cli.log(
      'Category: ' +
        scenario.category +
        '; live call required: ' +
        (scenario.requiresCarrier
          ? 'yes (separate exact one-shot approval)'
          : 'no'),
    );
    cli.log(
      'Preconditions:\n' +
        scenario.preconditions.map((item) => '  - ' + item).join('\n'),
    );
    cli.log(
      'Actions:\n' +
        scenario.actions
          .map((item, index) => '  ' + (index + 1) + '. ' + item)
          .join('\n'),
    );
    cli.log(
      'Expected:\n' + scenario.expected.map((item) => '  - ' + item).join('\n'),
    );
    cli.log(
      'Server/provider invariants:\n' +
        scenario.invariants.map((item) => '  - ' + item).join('\n'),
    );
    cli.log(
      'Inspect diagnostics:\n' +
        scenario.diagnostics.map((item) => '  - ' + item).join('\n'),
    );
    cli.log(
      'Component coverage (not proof of live call):\n' +
        scenario.automation.map((item) => '  - ' + item).join('\n'),
    );
  }
}

function getChildTestEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  // Strict environment allowlist: tests must never inherit live provider,
  // payment, webhook, DB or browser-session credentials.
  for (const key of [
    'PATH',
    'HOME',
    'TMPDIR',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
    'TZ',
    'USER',
    'CI',
    'BUN_INSTALL',
  ]) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  env.DIALER_INBOUND_ENABLED = 'false';
  env.CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION = '0';
  return env;
}

async function run() {
  try {
    const scenarios = resolveScenarioSelection(argv[1] ?? 'all');
    if (option('--seed') !== undefined)
      throw new Error(
        'Component tests use their own fixed fixtures. Use local-dialer-lab.ts --qa --seed for a seeded event schedule.',
      );
    const files = [
      ...new Set(scenarios.flatMap((scenario) => scenario.automation)),
    ].sort();
    if (files.length === 0)
      throw new Error('No allowlisted component tests for selection');
    const args = ['--no-env-file', 'test', ...files];
    cli.log(
      'Component coverage for ' +
        scenarios.map((scenario) => scenario.id).join(','),
    );
    cli.log('Command: bun ' + args.join(' '));
    cli.log('All carrier, payment and runtime credential inputs are disabled.');
    if (argv.includes('--dry-run')) return;
    const { stdout, stderr, exitCode, timedOut, recoveredPostgres } =
      await runBoundedQaProcess(
        [Bun.which('bun') ?? process.execPath, ...args],
        getChildTestEnv(),
        90_000,
        repoRoot,
      );
    const observation =
      exitCode === 0
        ? 'Allowlisted component tests passed. This does NOT prove a live carrier scenario.'
        : 'Allowlisted component tests failed (exit ' +
          exitCode +
          '); investigate before release.';
    const diagnostics = {
      command: 'bun --no-env-file test ' + files.join(' '),
      seedApplied: false,
      timedOut,
      recoveredPostgres,
      outputTail: (stderr || stdout).slice(-6000),
      source: 'component-regression',
      testFileCount: files.length,
    };
    for (const scenario of scenarios) {
      await saveEvidence(
        createLaunchEvidence({
          scenarioId: scenario.id,
          lane: 'automated',
          outcome: exitCode === 0 ? 'passed' : 'failed',
          testExitCode: exitCode,
          observation,
          diagnostics,
        }),
      );
    }
    cli.log(String(sanitizeDiagnosticValue((stderr || stdout).slice(-1800))));
    cli.log(
      'Saved ' +
        scenarios.length +
        ' sanitized automation records under ' +
        evidenceDirectory,
    );
    cli.log(
      'LIVE STATUS: NOT TESTED. Independently verify PSTN/VoIP, audio, server state and cleanup.',
    );
    if (exitCode !== 0) process.exitCode = 1;
  } catch (cause: unknown) {
    throw new Error('Dialer launch component test run failed', { cause });
  }
}

async function record() {
  try {
    const scenarioId = (argv[1] ?? '').toUpperCase();
    const outcome = required('--result') as EvidenceOutcome;
    if (!['passed', 'failed', 'blocked'].includes(outcome))
      throw new Error('--result must be passed, failed or blocked');
    let diagnostics: unknown = {};
    const diagnosticsFile = option('--diagnostics-json');
    if (diagnosticsFile) {
      const inputPath = isAbsolute(diagnosticsFile)
        ? diagnosticsFile
        : resolve(process.cwd(), diagnosticsFile);
      diagnostics = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
    }
    const trace = option('--trace-id');
    if (trace) diagnostics = { providerEvidence: diagnostics, traceId: trace };
    const evidence = createLaunchEvidence({
      scenarioId,
      lane: 'manual',
      outcome,
      observer: required('--observer'),
      observation: required('--note'),
      diagnostics,
    });
    const path = await saveEvidence(evidence);
    cli.log('Saved SANITIZED, UNVERIFIED human observation: ' + path);
    cli.log(
      'Reconcile against signed provider effects, backend session, capacity, locks and history before calling a live scenario verified.',
    );
  } catch (cause: unknown) {
    throw new Error('Unable to record Dialer launch observation', { cause });
  }
}

async function main() {
  try {
    switch (command) {
      case 'list':
        for (const scenario of launchScenarios) {
          cli.log(
            scenario.id +
              '  ' +
              scenario.category.padEnd(12) +
              '  ' +
              (scenario.requiresCarrier ? '[LIVE]' : '[SAFE]') +
              '  ' +
              scenario.title,
          );
        }
        cli.log(
          'Note: [LIVE] means exact one-shot call approval; no CLI command makes calls.',
        );
        return;
      case 'show':
        return show(argv[1] ?? 'all');
      case 'run':
        return run();
      case 'record':
        return record();
      case 'report':
        cli.log(formatLaunchReport(await loadEvidence()));
        return;
      case 'help':
        cli.log('Dialer launch QA — no commands initiate calls or payments.');
        cli.log(
          '  bun packages/dialer-server/scripts/launch-scenarios.ts list',
        );
        cli.log(
          '  bun packages/dialer-server/scripts/launch-scenarios.ts show S01',
        );
        cli.log(
          '  bun packages/dialer-server/scripts/launch-scenarios.ts run S01,S04',
        );
        cli.log(
          '  bun packages/dialer-server/scripts/launch-scenarios.ts run all --dry-run',
        );
        cli.log(
          '  bun packages/dialer-server/scripts/launch-scenarios.ts record S01 --result failed --observer QA --note "Audio vanished" --trace-id trace123',
        );
        cli.log(
          '  bun packages/dialer-server/scripts/launch-scenarios.ts record S01 --result blocked --observer QA --note "No mic permission" --diagnostics-json /local/sanitized.json',
        );
        cli.log(
          '  bun packages/dialer-server/scripts/launch-scenarios.ts report',
        );
        cli.log('Evidence: ' + evidenceDirectory);
        return;
      default:
        throw new Error('Unknown action ' + command + '; try help');
    }
  } catch (cause: unknown) {
    throw new Error('Dialer launch command failed', { cause });
  }
}

try {
  await main();
} catch (error: unknown) {
  let root = error;
  for (
    let depth = 0;
    depth < 8 && root instanceof Error && root.cause instanceof Error;
    depth++
  )
    root = root.cause;
  const message = root instanceof Error ? root.message : String(root);
  cli.warn(String(sanitizeDiagnosticValue(message)));
  process.exitCode = 1;
}
