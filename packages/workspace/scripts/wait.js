#!/usr/bin/env bun

// wait.js — timed sleep or wait for railway deploy to complete
//
// usage:
//   bun run wait                          # default 5m sleep
//   bun run wait -- 30                    # sleep 30 seconds
//   bun run wait -- 2m                    # sleep 2 minutes
//   bun run wait -- --deploy              # wait until current deploy succeeds or fails
//   bun run wait -- --deploy --timeout 10m # deploy wait with 10m max

const { execSync } = require('child_process');

function parseTime(s) {
  if (!s) return 300;
  const match = s.match(/^(\d+)(s|m|h)?$/);
  if (!match) return parseInt(s, 10) || 300;
  const n = parseInt(match[1], 10);
  const unit = match[2] || 's';
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  return n;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getLatestDeploy(service) {
  try {
    const raw = execSync(`railway deployment list --service ${service} --json 2>&1`, { encoding: 'utf8', timeout: 15000 });
    const deploys = JSON.parse(raw);
    if (!deploys.length) return null;
    return { id: deploys[0].id, status: deploys[0].status, message: deploys[0].meta?.commitMessage?.split('\n')[0] || '', commit: deploys[0].meta?.commitHash?.slice(0, 8) || '' };
  } catch { return null; }
}

async function waitForDeploy(service, timeoutSec) {
  const initial = getLatestDeploy(service);
  if (!initial) { console.error('could not get deployment info'); process.exit(1); }

  console.log(`waiting for deploy: ${initial.commit} — ${initial.message}`);
  console.log(`status: ${initial.status}, timeout: ${timeoutSec}s`);

  const start = Date.now();
  const deadline = start + timeoutSec * 1000;

  while (Date.now() < deadline) {
    const d = getLatestDeploy(service);
    if (!d) { await sleep(5000); continue; }

    if (d.id === initial.id) {
      if (d.status === 'SUCCESS') {
        const elapsed = Math.round((Date.now() - start) / 1000);
        console.log(`✓ deploy succeeded in ${elapsed}s`);
        return true;
      }
      if (d.status === 'FAILED' || d.status === 'CRASHED') {
        const elapsed = Math.round((Date.now() - start) / 1000);
        console.error(`✗ deploy ${d.status.toLowerCase()} after ${elapsed}s`);
        process.exit(1);
      }
      if (d.status === 'REMOVED') {
        console.log('deploy was superseded by a newer deploy');
        return true;
      }
    } else {
      // a newer deploy appeared — switch to tracking that one
      console.log(`new deploy detected: ${d.commit} — ${d.message}`);
      initial.id = d.id;
    }

    const remaining = Math.round((deadline - Date.now()) / 1000);
    process.stdout.write(`\r  ${d.status.toLowerCase()}... ${remaining}s remaining`);
    await sleep(10000);
  }

  console.error(`\ntimeout: deploy did not complete within ${timeoutSec}s`);
  process.exit(1);
}

async function timedSleep(seconds) {
  console.log(`sleeping ${seconds}s...`);
  const start = Date.now();
  const end = start + seconds * 1000;

  while (Date.now() < end) {
    const remaining = Math.round((end - Date.now()) / 1000);
    process.stdout.write(`\r  ${remaining}s remaining   `);
    await sleep(1000);
  }
  process.stdout.write('\r');
  console.log(`done (${seconds}s)`);
}

async function main() {
  const argv = process.argv.slice(2);
  let deployMode = false;
  let service = 'opensaas';
  let time = null;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--deploy': deployMode = true; break;
      case '--service': service = argv[++i]; break;
      case '--timeout': time = argv[++i]; break;
      case '--help':
        console.log('usage: bun run wait -- [time|--deploy] [--timeout time] [--service name]');
        console.log('');
        console.log('  bun run wait                    sleep 5m (default)');
        console.log('  bun run wait -- 30              sleep 30 seconds');
        console.log('  bun run wait -- 2m              sleep 2 minutes');
        console.log('  bun run wait -- --deploy        wait for railway deploy');
        console.log('  bun run wait -- --deploy --timeout 10m');
        return;
      default:
        if (!argv[i].startsWith('-')) time = argv[i];
        break;
    }
  }

  if (deployMode) {
    const timeout = parseTime(time || '15m');
    await waitForDeploy(service, timeout);
  } else {
    const seconds = parseTime(time || '5m');
    await timedSleep(seconds);
  }
}

main();
