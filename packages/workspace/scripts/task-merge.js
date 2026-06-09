#!/usr/bin/env bun

// task-merge.js — merge a PR and optionally wait for the railway deploy
//
// usage:
//   bun run task:merge -- --pr 171                # merge PR #171
//   bun run task:merge -- --pr 171 --wait         # merge + wait for deploy
//   bun run task:merge                            # merge PR from .task/current.json
//   bun run task:merge -- --wait                  # merge current task PR + wait

const { execSync } = require('child_process');
const { getToken, githubRequest, mergePullRequest } = require('./lib/github.js');
const { resolvePrRefNumber } = require('./lib/pr-ref');
const { findTaskMeta } = require('./lib/task-meta.js');

const DEFAULT_REPO = 'consuelohq/opensaas';
const DEFAULT_SERVICE = 'opensaas';

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function parseArgs(argv) {
  const args = { repo: DEFAULT_REPO, service: DEFAULT_SERVICE };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--pr': args.prNumber = resolvePrRefNumber(argv[++i], { repo: args.repo }); break;
      case '--github': args.prNumber = resolvePrRefNumber(argv[++i], { repo: args.repo }); break;
      case '--wait': args.wait = true; break;
      case '--timeout': { const t = argv[++i]; args.timeoutMs = (parseInt(t, 10) || 30) * 60 * 1000; break; }
      case '--squash': args.mergeMethod = 'squash'; break;
      case '--repo': args.repo = argv[++i]; break;
      case '--service': args.service = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--help':
        writeStdout('usage: bun run task:merge -- [options]');
        writeStdout('');
        writeStdout('  --pr <number-or-url> PR number or supported PR URL to merge (default: from .task/current.json)');
        writeStdout('  --wait            after merge, wait for railway deploy to complete');
        writeStdout('  --squash          squash merge (default: merge commit)');
        writeStdout('  --json            output json');
        process.exit(0);
      default:
        if (!argv[i].startsWith('-')) args.prNumber = resolvePrRefNumber(argv[i], { repo: args.repo });
        break;
    }
  }
  return args;
}

async function getPullRequest(token, repo, prNumber) {
  const [owner, name] = repo.split('/');
  return githubRequest({ token, endpoint: `/repos/${owner}/${name}/pulls/${prNumber}` });
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

function findDeployByCommit(deploys, sha) {
  return deploys.find((d) => d.commit.startsWith(sha.slice(0, 8)) || sha.startsWith(d.commit.slice(0, 8)));
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForDeploy(service, mergeSha, prNumber, timeoutMs) {
  writeStdout(`waiting for deploy of PR #${prNumber} (${mergeSha.slice(0, 8)})...`);

  const start = Date.now();
  const TIMEOUT = timeoutMs || 30 * 60 * 1000;
  let deployId = null;

  while (Date.now() - start < TIMEOUT) {
    const deploys = getDeploys(service);
    const match = findDeployByCommit(deploys, mergeSha);

    if (match) {
      if (!deployId) {
        deployId = match.id;
        writeStdout(`deploy found: ${match.commit.slice(0, 8)} — ${match.message}`);
      }

      if (match.status === 'SUCCESS') {
        const elapsed = Math.round((Date.now() - start) / 1000);
        writeStdout(`✓ deploy succeeded in ${elapsed}s`);
        return { deployed: true, elapsed, status: 'SUCCESS' };
      }
      if (match.status === 'FAILED' || match.status === 'CRASHED') {
        const elapsed = Math.round((Date.now() - start) / 1000);
        writeStderr(`✗ deploy ${match.status.toLowerCase()} after ${elapsed}s`);
        return { deployed: false, elapsed, status: match.status };
      }

      const elapsed = Math.round((Date.now() - start) / 1000);
      process.stdout.write(`\r  ${match.status.toLowerCase()}... ${elapsed}s elapsed   `);
    } else {
      const elapsed = Math.round((Date.now() - start) / 1000);
      process.stdout.write(`\r  waiting for deploy to appear... ${elapsed}s   `);
    }

    await sleep(15000);
  }

  writeStderr('\ntimeout: deploy did not complete within 30m');
  return { deployed: false, elapsed: Math.round((Date.now() - start) / 1000), status: 'TIMEOUT' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = getToken();

  // resolve PR number
  let prNumber = args.prNumber;
  if (!prNumber) {
    const meta = findTaskMeta(process.cwd());
    prNumber = meta?.prNumber || meta?.taskPrNumber;
    if (!prNumber) {
      writeStderr('no --pr specified and no .task/current.json with prNumber found');
      process.exit(1);
    }
    writeStdout(`found PR #${prNumber} from task metadata`);
  }

  // fetch PR
  const pr = await getPullRequest(token, args.repo, prNumber);
  writeStdout(`PR #${prNumber}: ${pr.title}`);
  writeStdout(`${pr.head.ref} → ${pr.base.ref}`);

  if (pr.merged_at) {
    writeStdout(`already merged at ${pr.merged_at}`);
    const mergeSha = pr.merge_commit_sha;
    if (args.wait && mergeSha) {
      writeStdout(`merge commit: ${mergeSha.slice(0, 8)}`);
      const result = await waitForDeploy(args.service, mergeSha, prNumber, args.timeoutMs);
      if (args.json) writeStdout(JSON.stringify({ prNumber, merged: true, alreadyMerged: true, mergeSha, deploy: result }, null, 2));
      return;
    }
    if (args.wait && mergeSha) {
      writeStdout(`\nnext: bun run wait -- --deploy ${mergeSha.slice(0, 8)}`);
    }
    return;
  }

  if (pr.state !== 'open') {
    writeStderr(`PR #${prNumber} is ${pr.state}, cannot merge`);
    process.exit(1);
  }

  // merge
  writeStdout('merging...');
  const mergeResult = await mergePullRequest({
    token,
    repository: args.repo,
    prNumber,
    commitTitle: pr.title,
    mergeMethod: args.mergeMethod || 'squash',
  });

  const mergeSha = mergeResult.sha;
  writeStdout(`✓ merged — commit ${mergeSha.slice(0, 8)}`);

  if (args.json && !args.wait) {
    writeStdout(JSON.stringify({ prNumber, merged: true, mergeSha, title: pr.title }, null, 2));
    return;
  }

  if (args.wait) {
    writeStdout('');
    const result = await waitForDeploy(args.service, mergeSha, prNumber);
    if (args.json) writeStdout(JSON.stringify({ prNumber, merged: true, mergeSha, title: pr.title, deploy: result }, null, 2));
  } else {
    writeStdout(`\nnext: bun run task:merge -- --pr ${prNumber} --wait`);
    writeStdout(`  or: bun run wait -- --deploy ${mergeSha.slice(0, 8)}`);
  }
}

main().catch((err) => {
  writeStderr(err.message || 'unknown error');
  process.exit(1);
});
