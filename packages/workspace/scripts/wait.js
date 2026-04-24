#!/usr/bin/env bun

// wait.js — timed sleep or wait for a specific railway deploy
//
// usage:
//   bun run wait                              # sleep 5m
//   bun run wait -- 30                        # sleep 30 seconds
//   bun run wait -- 2m                        # sleep 2 minutes
//   bun run wait -- --deploy                  # wait for deploy matching local HEAD
//   bun run wait -- --deploy <commit>         # wait for deploy matching specific commit

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

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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
  console.log('recent deploys:');
  deploys.slice(0, 6).forEach((d, i) => {
    const age = Math.round((Date.now() - new Date(d.created).getTime()) / 60000);
    console.log(`  ${i + 1}. ${d.commit.slice(0, 8)} ${d.status.padEnd(10)} ${age}m ago  ${d.message.slice(0, 60)}`);
  });
}

async function waitForDeploy(service, commitPrefix, timeoutMs) {
  const deploys = getDeploys(service);
  if (!deploys.length) { console.error('no deploys found'); process.exit(1); }

  let target = commitPrefix ? findDeploy(deploys, commitPrefix) : null;

  if (!target && commitPrefix) {
    console.error(`no deploy found for commit ${commitPrefix.slice(0, 8)}`);
    printDeploys(deploys);
    process.exit(1);
  }

  if (!target) {
    // no commit specified — match local HEAD
    const head = getLocalHead();
    if (head) target = findDeploy(deploys, head);
    if (!target) {
      // HEAD not deployed yet — show list, wait for most recent
      console.log(`local HEAD ${(head || '?').slice(0, 8)} not found in deploys, using most recent:`);
      target = deploys[0];
    }
  }

  console.log(`tracking: ${target.commit.slice(0, 8)} — ${target.message}`);
  console.log(`status: ${target.status}`);

  if (target.status === 'SUCCESS') { console.log('✓ already succeeded'); return; }
  if (target.status === 'FAILED' || target.status === 'CRASHED') {
    console.error(`✗ already ${target.status.toLowerCase()}`);
    process.exit(1);
  }

  const start = Date.now();
  const TIMEOUT = timeoutMs || 30 * 60 * 1000;

  while (Date.now() - start < TIMEOUT) {
    await sleep(15000);
    const fresh = getDeploys(service);
    const current = fresh.find((d) => d.id === target.id);

    if (!current) {
      // deploy disappeared (superseded)
      const replacement = fresh.find((d) => d.status === 'SUCCESS' || d.status === 'BUILDING' || d.status === 'DEPLOYING');
      if (replacement) {
        console.log(`\ndeploy superseded, now tracking: ${replacement.commit.slice(0, 8)} — ${replacement.message}`);
        target = replacement;
        continue;
      }
      console.log('\ndeploy removed');
      return;
    }

    if (current.status === 'SUCCESS') {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`\n✓ deploy succeeded in ${elapsed}s`);
      return;
    }
    if (current.status === 'FAILED' || current.status === 'CRASHED') {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.error(`\n✗ deploy ${current.status.toLowerCase()} after ${elapsed}s`);
      process.exit(1);
    }
    if (current.status === 'REMOVED') {
      console.log('\ndeploy was superseded');
      return;
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    process.stdout.write(`\r  ${current.status.toLowerCase()}... ${elapsed}s elapsed`);
  }

  console.error('\ntimeout: deploy did not complete within 30m');
  process.exit(1);
}

async function timedSleep(seconds) {
  console.log(`sleeping ${seconds}s...`);
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    process.stdout.write(`\r  ${Math.round((end - Date.now()) / 1000)}s remaining   `);
    await sleep(1000);
  }
  process.stdout.write('\r');
  console.log(`done (${seconds}s)`);
}

async function main() {
  const argv = process.argv.slice(2);
  let deployMode = false;
  let service = 'opensaas';
  let timeoutMs = null;
  let commitOrTime = null;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--deploy': deployMode = true; break;
      case '--service': service = argv[++i]; break;
      case '--timeout': timeoutMs = parseTime(argv[++i]) * 1000; break;
      case '--help':
        console.log('usage: bun run wait -- [time|--deploy [commit]] [--service name]');
        console.log('');
        console.log('  bun run wait                       sleep 5m (default)');
        console.log('  bun run wait -- 30                 sleep 30 seconds');
        console.log('  bun run wait -- 2m                 sleep 2 minutes');
        console.log('  bun run wait -- --deploy           wait for deploy matching local HEAD');
        console.log('  bun run wait -- --deploy abc123    wait for deploy matching commit');
        console.log('');
        console.log('options:');
        console.log('  --service <name>   railway service (default: opensaas)');
        console.log('  --timeout <time>   deploy wait timeout (default: 30m)');
        return;
      default:
        if (!argv[i].startsWith('-')) commitOrTime = argv[i];
        break;
    }
  }

  if (deployMode) {
    await waitForDeploy(service, commitOrTime, timeoutMs);
  } else {
    await timedSleep(parseTime(commitOrTime || '5m'));
  }
}

main();
