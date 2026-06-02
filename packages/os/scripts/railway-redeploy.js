#!/usr/bin/env bun

// railway-redeploy.js — trigger railway redeploys and optionally wait for completion

const { execFileSync, spawnSync } = require('child_process');

const DEFAULT_SERVICES = ['opensaas'];
const ALL_SERVICES = ['opensaas', 'twenty-worker'];

function writeStdout(message = '') {
  process.stdout.write(`${message}\n`);
}

function writeStderr(message = '') {
  process.stderr.write(`${message}\n`);
}

function parseTime(value) {
  const match = String(value).match(/^(\d+)(s|m|h)?$/);
  if (!match) {
    throw new Error(`invalid timeout: ${value} (expected: 90, 90s, 10m, or 1h)`);
  }

  const count = parseInt(match[1], 10);
  const unit = match[2] || 's';

  if (unit === 'h') return count * 60 * 60 * 1000;
  if (unit === 'm') return count * 60 * 1000;

  return count * 1000;
}

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${option} requires a value`);
  }

  return value;
}

function parseArgs(argv) {
  const args = {
    services: [],
    wait: false,
    timeoutMs: 30 * 60 * 1000,
    json: false,
    quiet: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    switch (arg) {
      case '--service': {
        const value = readOptionValue(argv, index, '--service');
        args.services.push(value);
        index += 1;
        break;
      }
      case '--all':
        args.services.push(...ALL_SERVICES);
        break;
      case '--wait':
        args.wait = true;
        break;
      case '--timeout': {
        const value = readOptionValue(argv, index, '--timeout');
        args.timeoutMs = parseTime(value);
        index += 1;
        break;
      }
      case '--json':
        args.json = true;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        if (!arg.startsWith('-')) {
          args.services.push(arg);
        } else {
          throw new Error(`unknown option: ${arg}`);
        }
    }
  }

  const services = args.services.length > 0 ? args.services : DEFAULT_SERVICES;
  args.services = [...new Set(services.filter(Boolean))];

  return args;
}

function printHelp() {
  writeStdout('usage: bun run railway:redeploy -- [options] [service]');
  writeStdout('');
  writeStdout('trigger a railway redeploy using the railway cli, with optional deploy polling.');
  writeStdout('');
  writeStdout('examples:');
  writeStdout('  bun run railway:redeploy -- --wait');
  writeStdout('  bun run railway:redeploy -- --service twenty-worker --wait');
  writeStdout('  bun run railway:redeploy -- --all --wait');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --service <name>  service to redeploy; may be repeated (default: opensaas)');
  writeStdout('  --all             redeploy opensaas and twenty-worker');
  writeStdout('  --wait            wait for each new deployment to finish');
  writeStdout('  --timeout <time>  wait timeout, e.g. 10m or 1800s (default: 30m)');
  writeStdout('  --json            print structured json');
  writeStdout('  --quiet           suppress progress output');
  writeStdout('  --help            show this help');
}

function getDeploys(service) {
  const raw = execFileSync('railway', ['deployment', 'list', '--service', service, '--json'], {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return JSON.parse(raw).map((deployment) => ({
    id: deployment.id,
    status: deployment.status,
    commit: deployment.meta?.commitHash || '',
    message: (deployment.meta?.commitMessage || '').split('\n')[0],
    createdAt: deployment.createdAt,
  }));
}

function runRedeploy(service) {
  const result = spawnSync('railway', ['redeploy', '--service', service], {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(output || `railway redeploy failed for ${service}`);
  }

  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function findNewDeployment(beforeDeploys, afterDeploys) {
  const beforeIds = new Set(beforeDeploys.map((deployment) => deployment.id));
  return afterDeploys.find((deployment) => !beforeIds.has(deployment.id)) ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFailedStatus(status) {
  return ['FAILED', 'CRASHED', 'REMOVED'].includes(status);
}

async function waitForDeployment(service, deployment, timeoutMs, quiet) {
  if (!deployment) {
    throw new Error(`no deployment found for ${service}`);
  }

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const deploys = getDeploys(service);
    const current = deploys.find((item) => item.id === deployment.id) ?? deploys[0];

    if (!current) {
      throw new Error(`no deployments found while waiting for ${service}`);
    }

    if (current.status === 'SUCCESS') {
      if (!quiet) writeStdout(`✓ ${service} redeployed: ${current.commit.slice(0, 8) || current.id}`);
      return current;
    }

    if (isFailedStatus(current.status)) {
      throw new Error(`${service} redeploy ${current.status.toLowerCase()}`);
    }

    if (!quiet) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      process.stdout.write(`\r  ${service}: ${current.status.toLowerCase()}... ${elapsed}s elapsed`);
    }

    await sleep(15000);
  }

  throw new Error(`${service} redeploy timed out after ${Math.round(timeoutMs / 1000)}s`);
}

async function redeployService(service, args) {
  const beforeDeploys = getDeploys(service);

  if (!args.quiet) writeStdout(`redeploying ${service}...`);
  const output = runRedeploy(service);

  await sleep(3000);

  const afterDeploys = getDeploys(service);
  const deployment = findNewDeployment(beforeDeploys, afterDeploys);
  if (!deployment) {
    throw new Error(`no new deployment detected for ${service}`);
  }

  const result = {
    service,
    deployment,
    output,
    waited: false,
    finalDeployment: deployment,
  };

  if (!args.wait) {
    if (!args.quiet) {
      writeStdout(`${service}: ${deployment.status} ${deployment.commit.slice(0, 8) || deployment.id}`);
    }
    return result;
  }

  result.waited = true;
  result.finalDeployment = await waitForDeployment(service, deployment, args.timeoutMs, args.quiet);

  return result;
}

async function main() {
  const wantsJson = process.argv.slice(2).includes('--json');
  let args;

  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error /* unknown */) {
    const message = error instanceof Error ? error.message : String(error);
    if (wantsJson) {
      writeStdout(JSON.stringify({ ok: false, error: message, results: [] }, null, 2));
    } else {
      writeStderr(message);
    }
    process.exit(1);
  }

  const results = [];

  try {
    for (const service of args.services) {
      results.push(await redeployService(service, args));
    }

    if (args.json) {
      writeStdout(JSON.stringify({ ok: true, results }, null, 2));
    }
  } catch (error /* unknown */) {
    if (args.json) {
      writeStdout(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        results,
      }, null, 2));
    } else {
      writeStderr(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

main();
