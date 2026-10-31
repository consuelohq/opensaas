#!/usr/bin/env bun
'use strict';

const { execFileSync } = require('child_process');
const { resolveGitRoot } = require('./lib/paths');
const { computeVerificationState } = require('./lib/verification');
const { waitForVerifyRun } = require('./lib/verify-run-state');

const WAIT_DEFAULT_SECONDS = 60;
const WAIT_MAX_SECONDS = 90;
const FAILED_SAMPLE_LIMIT = 4;

function parseArgs(argv) {
  const args = { waitSeconds: WAIT_DEFAULT_SECONDS, json: false };
  for (let i = 0; i < argv.length; i++) {
    const part = argv[i];
    const [flag, inline] = part.split('=', 2);
    if (flag === '--json') {
      args.json = true;
      continue;
    }
    if (flag === '--run-key' || flag === '--wait-seconds') {
      const value = inline === undefined ? argv[++i] : inline;
      if (flag === '--run-key') args.runKey = value;
      else args.waitSeconds = Number(value);
      continue;
    }
    throw new Error('unknown flag: ' + part);
  }
  if (typeof args.runKey !== 'string' || !/^[a-f0-9]{64}$/.test(args.runKey)) {
    throw new Error('verify run key must be 64 lowercase SHA-256 hexadecimal characters');
  }
  if (!Number.isSafeInteger(args.waitSeconds) || args.waitSeconds < 0 || args.waitSeconds > WAIT_MAX_SECONDS) {
    throw new Error('--wait-seconds must be between 0 and ' + WAIT_MAX_SECONDS);
  }
  return args;
}

function safePreview(value, max = 600) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function failureSummary(summary) {
  const selection = summary?.testSelection?.data || {};
  const suites = Array.isArray(selection.failedSuites)
    ? selection.failedSuites
    : Array.isArray(selection.runResults)
      ? selection.runResults.filter((run) => run.status === 'failed')
      : [];
  return suites.slice(0, FAILED_SAMPLE_LIMIT).map((suite) => ({
    name: safePreview(suite.name, 160),
    exitCode: typeof suite.exitCode === 'number' ? suite.exitCode : null,
    output: safePreview(suite.outputTail || suite.error?.message || suite.output || '', 600),
  }));
}

function isSourceStale(repoRoot, state) {
  if (!state.headSha || !state.changeHash) return true;
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const branch = execFileSync('git', ['branch', '--show-current'], {
      cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (head !== state.headSha || branch !== state.branch) return true;
    if (state.base && !state.baseSha) return true;
    if (state.base && state.baseSha) {
      const baseSha = execFileSync('git', ['rev-parse', '--verify', state.base], {
        cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (baseSha !== state.baseSha) return true;
    }
    return computeVerificationState(repoRoot, branch).changeHash !== state.changeHash;
  } catch {
    return true;
  }
}

function formatStatus(repoRoot, state, waitSeconds) {
  const common = {
    schema: 'verify.status.v1',
    runKey: state.runKey,
    branch: state.branch ?? null,
    base: state.base ?? null,
    headSha: state.headSha ?? null,
    startedAt: state.startedAt ?? null,
    completedAt: state.completedAt ?? null,
    phase: state.phase || state.state,
    workerPid: state.workerPid ?? null,
  };
  if (state.state === 'not_found') {
    return {
      ...common,
      status: 'VERIFY_NOT_FOUND', pending: false, terminal: true, passed: null, publishValid: false,
      message: 'No verification was recorded for this run key. Status did not launch a job.',
      nextAction: 'Call verify once with the intended task session to start a run, then monitor its returned runKey using verify.status.',
    };
  }
  const stale = isSourceStale(repoRoot, state);
  if (state.pending) {
    return {
      ...common,
      status: 'VERIFY_PENDING', pending: true, terminal: false, passed: null, publishValid: false,
      stale,
      elapsedSeconds: state.elapsedSeconds ?? null,
      retryAfterSeconds: 60,
      message: 'Verification is still running; this read-only check waited up to ' + waitSeconds + ' seconds without launching another run.',
      nextAction: 'Use verify.status with the SAME runKey and waitSeconds:60 to continue watching; do not call verify again to poll.',
    };
  }
  if (state.state === 'aborted' || state.state === 'orphaned' || state.state === 'unavailable') {
    return {
      ...common,
      status: state.state === 'orphaned' ? 'VERIFY_ORPHANED' : 'VERIFY_ABORTED',
      pending: false, terminal: true, passed: false, publishValid: false,
      reason: safePreview(state.reason || 'verification did not finish'),
      nextAction: 'Check the stopped worker and fix the cause. Use verify with retry:true only if explicitly restarting the failed run is appropriate.',
    };
  }
  const summary = state.summary || {};
  const checks = {
    review: typeof summary.review?.passed === 'boolean' ? summary.review.passed : null,
    tests: typeof summary.testSelection?.passed === 'boolean' ? summary.testSelection.passed : null,
    db: typeof summary.db?.passed === 'boolean' ? summary.db.passed : null,
  };
  const passed = state.state === 'passed' && state.passed === true;
  const publishValid = passed && !stale && state.publishValid === true;
  const status = stale && passed ? 'VERIFY_STALE' : passed ? 'VERIFY_PASSED' : 'VERIFY_FAILED';
  return {
    ...common, status, pending: false, terminal: true,
    stale, passed: passed && !stale, publishValid, exitCode: state.exitCode ?? null,
    checks, failedSuites: failureSummary(summary),
    stamp: {
      publishValid,
      path: typeof summary.stampPath === 'string' ? summary.stampPath : null,
    },
    message: stale && passed
      ? 'Verification was for a different head, base, or worktree snapshot; its result cannot authorize publication.'
      : passed ? 'Verification completed successfully.' : stale
        ? 'Verification failed on an older task snapshot; inspect its findings and rerun on the current snapshot.'
        : 'Verification completed with failures.',
    nextAction: stale && passed
      ? 'Re-run verify once on the changed task snapshot; inspect the new runKey using verify.status.'
      : passed
        ? publishValid ? 'Publication checks passed; proceed through task.push and task.pr.' : 'Verification passed without a publish-valid stamp; inspect the gate and rerun only if appropriate.'
        : 'Inspect failedSuites and check results, fix attributable failures, then use verify with retry:true for an intentional rerun. Unchanged failures are cached.',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolveGitRoot(process.env.TASK_WORKTREE || process.cwd());
  const state = await waitForVerifyRun(repoRoot, args.runKey, { waitMs: args.waitSeconds * 1000 });
  const payload = formatStatus(repoRoot, state, args.waitSeconds);
  process.stdout.write(JSON.stringify(payload) + '\n');
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write('verify-status: ' + (error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, formatStatus, isSourceStale };
