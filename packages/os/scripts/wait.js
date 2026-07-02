#!/usr/bin/env bun

// wait.js — timed sleep, detached sleep checkpoints, or wait for a specific railway deploy
//
// usage:
//   bun run wait                              # sleep 5m
//   bun run wait -- 30                        # sleep 30 seconds
//   bun run wait -- 2m                        # sleep 2 minutes
//   bun run wait -- --detach --duration 24h   # create a non-blocking 24h wait job
//   bun run wait -- --status <id>             # inspect a detached wait job
//   bun run wait -- --deploy                  # wait for deploy matching local HEAD
//   bun run wait -- --deploy <commit>         # wait for deploy matching specific commit

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function parseTime(s) {
  if (!s) return 300;
  const text = String(s).trim();
  const match = text.match(/^(\d+)(s|m|h|d)?$/);
  if (!match) return parseInt(text, 10) || 300;
  const n = parseInt(match[1], 10);
  const unit = match[2] || 's';
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return n;
}

function formatIso(ms) {
  return new Date(ms).toISOString();
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function writeStdout(value = '') { process.stdout.write(`${value}\n`); }
function writeStderr(value = '') { process.stderr.write(`${value}\n`); }

function getWaitHome() {
  return process.env.WORKSPACE_WAIT_HOME || path.join(os.homedir(), '.consuelo', 'workspace', 'waits');
}

function ensureWaitHome() {
  const dir = getWaitHome();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function waitPath(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`invalid wait id: ${id}`);
  return path.join(ensureWaitHome(), `${id}.json`);
}

function readWaitJob(id) {
  const filePath = waitPath(id);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeWaitJob(job) {
  const filePath = waitPath(job.id);
  fs.writeFileSync(filePath, `${JSON.stringify(job, null, 2)}\n`);
}

function withComputedStatus(job, nowMs = Date.now()) {
  const wakeMs = Date.parse(job.wakeAt);
  const remainingSeconds = Math.max(0, Math.ceil((wakeMs - nowMs) / 1000));
  const status = remainingSeconds === 0 ? 'complete' : 'pending';
  const next = {
    ...job,
    status,
    remainingSeconds,
  };
  if (status === 'complete' && !next.completedAt) next.completedAt = formatIso(nowMs);
  return next;
}

function createDetachedWait({ durationText, reason }) {
  const durationSeconds = parseTime(durationText || '5m');
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`invalid wait duration: ${durationText}`);
  }
  const createdMs = Date.now();
  const id = `wait_${createdMs.toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const job = {
    id,
    mode: 'sleep',
    status: 'pending',
    duration: durationText || `${durationSeconds}s`,
    durationSeconds,
    reason: reason || '',
    createdAt: formatIso(createdMs),
    wakeAt: formatIso(createdMs + durationSeconds * 1000),
    checkCommand: `bun run wait -- --status ${id}`,
    workspaceCall: { tool: 'wait', input: { status: id } },
  };
  writeWaitJob(job);
  return withComputedStatus(job, createdMs);
}

function getDetachedWaitStatus(id) {
  const job = readWaitJob(id);
  if (!job) {
    return {
      id,
      status: 'missing',
      ok: false,
      message: `wait job not found: ${id}`,
    };
  }
  const next = withComputedStatus(job);
  if (next.status !== job.status || next.completedAt !== job.completedAt || next.remainingSeconds !== job.remainingSeconds) {
    writeWaitJob(next);
  }
  return {
    ...next,
    ok: true,
    message: next.status === 'complete' ? 'wait is complete' : 'wait is still pending',
  };
}

function listDetachedWaits() {
  const dir = ensureWaitHome();
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => getDetachedWaitStatus(name.replace(/\.json$/, '')))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function printJson(value) {
  writeStdout(JSON.stringify(value, null, 2));
}

function getLocalHead() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
  } catch { return null; }
}

function getDeploys(service) {
  try {
    const raw = execSync(`railway deployment list --service ${service} --json 2>&1`, { encoding: 'utf8', timeout: 15000 });
    return JSON.parse(raw).map((d) => ({
      id: d.id,
      status: d.status,
      commit: d.meta?.commitHash || '',
      message: (d.meta?.commitMessage || '').split('\n')[0],
      created: d.createdAt,
    }));
  } catch { return []; }
}

function findDeploy(deploys, commitPrefix) {
  return deploys.find((d) => d.commit.startsWith(commitPrefix) || commitPrefix.startsWith(d.commit.slice(0, 8)));
}

function printDeploys(deploys) {
  writeStdout('recent deploys:');
  deploys.slice(0, 6).forEach((d, i) => {
    const age = Math.round((Date.now() - new Date(d.created).getTime()) / 60000);
    writeStdout(`  ${i + 1}. ${d.commit.slice(0, 8)} ${d.status.padEnd(10)} ${age}m ago  ${d.message.slice(0, 60)}`);
  });
}

async function waitForDeploy(service, commitPrefix, timeoutMs) {
  const deploys = getDeploys(service);
  if (!deploys.length) { writeStderr('no deploys found'); process.exit(1); }

  let target = commitPrefix ? findDeploy(deploys, commitPrefix) : null;

  if (!target && commitPrefix) {
    writeStderr(`no deploy found for commit ${commitPrefix.slice(0, 8)}`);
    printDeploys(deploys);
    process.exit(1);
  }

  if (!target) {
    const head = getLocalHead();
    if (head) target = findDeploy(deploys, head);
    if (!target) {
      writeStdout(`local HEAD ${(head || '?').slice(0, 8)} not found in deploys, using most recent:`);
      target = deploys[0];
    }
  }

  writeStdout(`tracking: ${target.commit.slice(0, 8)} - ${target.message}`);
  writeStdout(`status: ${target.status}`);

  if (target.status === 'SUCCESS') { writeStdout('already succeeded'); return; }
  if (target.status === 'FAILED' || target.status === 'CRASHED') {
    writeStderr(`already ${target.status.toLowerCase()}`);
    process.exit(1);
  }

  const start = Date.now();
  const TIMEOUT = timeoutMs || 30 * 60 * 1000;

  while (Date.now() - start < TIMEOUT) {
    await sleep(15000);
    const fresh = getDeploys(service);
    const current = fresh.find((d) => d.id === target.id);

    if (!current) {
      const replacement = fresh.find((d) => d.status === 'SUCCESS' || d.status === 'BUILDING' || d.status === 'DEPLOYING');
      if (replacement) {
        writeStdout(`\ndeploy superseded, now tracking: ${replacement.commit.slice(0, 8)} - ${replacement.message}`);
        target = replacement;
        continue;
      }
      writeStdout('\ndeploy removed');
      return;
    }

    if (current.status === 'SUCCESS') {
      const elapsed = Math.round((Date.now() - start) / 1000);
      printJson({ ok: true, kind: 'deploy', status: 'completed', conclusion: 'success', commit: current.commit, waitedSeconds: elapsed, summary: `deploy succeeded in ${elapsed}s` });
      return;
    }
    if (current.status === 'FAILED' || current.status === 'CRASHED') {
      const elapsed = Math.round((Date.now() - start) / 1000);
      printJson({ ok: false, kind: 'deploy', status: 'failed', conclusion: current.status.toLowerCase(), commit: current.commit, waitedSeconds: elapsed, summary: `deploy ${current.status.toLowerCase()} after ${elapsed}s` });
      process.exit(1);
    }
    if (current.status === 'REMOVED') {
      writeStdout('\ndeploy was superseded');
      return;
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    // Quiet wait: progress stays out of chat-visible stdout.
  }

  printJson({ ok: false, kind: 'deploy', status: 'timed_out', summary: 'timeout: deploy did not complete within 30m' });
  process.exit(1);
}


function getPrChecks(prNumber) {
  try {
    const pr = Number(prNumber);
    if (!Number.isInteger(pr) || pr <= 0) throw new Error(`invalid PR number: ${prNumber}`);
    const raw = execSync(`gh pr checks ${pr} --json name,state,conclusion,bucket,link 2>&1`, { encoding: 'utf8', timeout: 20000 });
    return JSON.parse(raw).map((check) => ({
      name: check.name || '',
      state: check.state || '',
      conclusion: check.conclusion || '',
      bucket: check.bucket || '',
      link: check.link || '',
    }));
  } catch (error) {
    return { error: error?.message || String(error) };
  }
}

function summarizeChecks(checks) {
  if (!Array.isArray(checks)) return { passed: 0, failed: 0, pending: 0, total: 0 };
  let passed = 0;
  let failed = 0;
  let pending = 0;
  for (const check of checks) {
    const conclusion = String(check.conclusion || '').toUpperCase();
    const state = String(check.state || '').toUpperCase();
    const bucket = String(check.bucket || '').toUpperCase();
    if (['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(conclusion) || bucket === 'PASSING') passed += 1;
    else if (['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(conclusion) || bucket === 'FAILING') failed += 1;
    else if (state === 'COMPLETED' && conclusion) failed += 1;
    else pending += 1;
  }
  return { passed, failed, pending, total: checks.length };
}

async function waitForPrChecks(prNumber, timeoutMs) {
  try {
  const pr = Number(prNumber);
  if (!Number.isInteger(pr) || pr <= 0) throw new Error(`invalid PR number: ${prNumber}`);
  const startedAt = Date.now();
  const timeout = timeoutMs || 30 * 60 * 1000;
  const pollMs = Number(process.env.WORKSPACE_WAIT_POLL_MS || 30000);
  while (Date.now() - startedAt < timeout) {
    const checks = getPrChecks(pr);
    if (!Array.isArray(checks)) {
      printJson({ ok: false, kind: 'pr_checks', status: 'failed', pr, error: checks.error, summary: `failed to read PR checks for #${pr}` });
      process.exit(1);
    }
    const counts = summarizeChecks(checks);
    if (counts.failed > 0) {
      printJson({ ok: false, kind: 'pr_checks', status: 'failed', pr, conclusion: 'failure', checks: counts, failedChecks: checks.filter((check) => String(check.conclusion || check.bucket).match(/FAIL|CANCEL|TIME|ACTION/i)).map((check) => check.name), startedAt: formatIso(startedAt), completedAt: formatIso(Date.now()), summary: `PR #${pr} checks failed` });
      process.exit(1);
    }
    if (counts.total > 0 && counts.pending === 0) {
      printJson({ ok: true, kind: 'pr_checks', status: 'completed', pr, conclusion: 'success', checks: counts, startedAt: formatIso(startedAt), completedAt: formatIso(Date.now()), summary: `all PR #${pr} checks completed successfully` });
      return;
    }
    await sleep(pollMs);
  }
  const checks = getPrChecks(pr);
  const counts = Array.isArray(checks) ? summarizeChecks(checks) : { passed: 0, failed: 0, pending: 0, total: 0 };
  printJson({ ok: false, kind: 'pr_checks', status: 'timed_out', pr, checks: counts, startedAt: formatIso(startedAt), completedAt: formatIso(Date.now()), summary: `timed out waiting for PR #${pr} checks` });
  process.exit(1);
  } catch (error) {
    printJson({ ok: false, kind: 'pr_checks', status: 'failed', error: error?.message || String(error), summary: 'PR check wait failed' });
    process.exit(1);
  }
}

async function timedSleep(seconds) {
  try {
  const startedAt = Date.now();
  await sleep(seconds * 1000);
  printJson({
    ok: true,
    kind: 'duration',
    status: 'completed',
    startedAt: formatIso(startedAt),
    completedAt: formatIso(Date.now()),
    waitedMs: Math.max(0, Date.now() - startedAt),
    summary: `wait completed after ${seconds}s`,
  });
  } catch (error) {
    printJson({ ok: false, kind: 'duration', status: 'failed', error: error?.message || String(error), summary: 'wait failed' });
    process.exit(1);
  }
}

function printHelp() {
  writeStdout('usage: bun run wait -- [time|--deploy [commit]] [options]');
  writeStdout('');
  writeStdout('  bun run wait                       sleep 5m (default)');
  writeStdout('  bun run wait -- 30                 sleep 30 seconds');
  writeStdout('  bun run wait -- 2m                 sleep 2 minutes');
  writeStdout('  bun run wait -- --detach --duration 24h --reason "wake after deploy window"');
  writeStdout('  bun run wait -- --status <id>      inspect a detached wait');
  writeStdout('  bun run wait -- --list             list detached waits');
  writeStdout('  bun run wait -- --deploy           wait for deploy matching local HEAD');
  writeStdout('  bun run wait -- --deploy abc123    wait for deploy matching commit');
  writeStdout('  bun run wait -- --pr 1313          wait for GitHub PR checks');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --detach           create a non-blocking wait job and return immediately');
  writeStdout('  --duration <time>  duration for detached or synchronous wait, e.g. 30s, 10m, 4h, 1d');
  writeStdout('  --status <id>      show status for a detached wait job');
  writeStdout('  --list             list detached wait jobs');
  writeStdout('  --reason <text>    record why the wait exists');
  writeStdout('  --service <name>   railway service (default: opensaas)');
  writeStdout('  --timeout <time>   condition wait timeout (default: 30m)');
}

async function main() {
  const argv = process.argv.slice(2);
  let deployMode = false;
  let detached = false;
  let service = 'opensaas';
  let timeoutMs = null;
  let commitOrTime = null;
  let durationText = null;
  let reason = '';
  let statusId = null;
  let listMode = false;
  let prNumber = null;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--deploy': deployMode = true; break;
      case '--detach':
      case '--detached': detached = true; break;
      case '--duration': durationText = argv[++i]; break;
      case '--reason': reason = argv[++i] || ''; break;
      case '--status': statusId = argv[++i]; break;
      case '--list': listMode = true; break;
      case '--pr': prNumber = argv[++i]; break;
      case '--service': service = argv[++i]; break;
      case '--timeout': timeoutMs = parseTime(argv[++i]) * 1000; break;
      case '--help':
        printHelp();
        return;
      default:
        if (!argv[i].startsWith('-')) commitOrTime = argv[i];
        break;
    }
  }

  if (statusId) {
    printJson(getDetachedWaitStatus(statusId));
    return;
  }

  if (listMode) {
    printJson({ ok: true, waits: listDetachedWaits() });
    return;
  }

  if (prNumber) {
    await waitForPrChecks(prNumber, timeoutMs);
    return;
  }

  if (detached) {
    if (deployMode) {
      writeStderr('detached deploy waits are not supported yet; use synchronous --deploy or detached sleep checkpoints');
      process.exit(1);
    }
    printJson({ ok: true, wait: createDetachedWait({ durationText: durationText || commitOrTime || '5m', reason }) });
    return;
  }

  if (deployMode) {
    await waitForDeploy(service, commitOrTime, timeoutMs);
  } else {
    await timedSleep(parseTime(durationText || commitOrTime || '5m'));
  }
}

main().catch((error) => {
  writeStderr(error?.message || String(error));
  process.exit(1);
});
