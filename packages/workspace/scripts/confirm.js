#!/usr/bin/env bun

const { spawnSync } = require('child_process');

const { resolveGitRoot } = require('./lib/paths');
const { appendEvidenceEvent } = require('./lib/state/evidence-log');
const { readExploreState, writeExploreState } = require('./lib/state/explore-state');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run confirm -- [options]');
  writeStdout('');
  writeStdout('judge whether the current path proved out under validation or runtime truth.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --verify          run bun run verify and interpret the result');
  writeStdout('  --runtime         run bun run railway:logs -- --errors --json');
  writeStdout('  --test <pattern>  run npx jest <pattern> --runInBand');
  writeStdout('  --json            output structured json');
  writeStdout('  --help            show this help');
}

function parseArgs(argv) {
  const args = {
    json: false,
    runtime: false,
    tests: [],
    verify: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--verify':
        args.verify = true;
        break;
      case '--runtime':
        args.runtime = true;
        break;
      case '--test': {
        const next = argv[index + 1];
        if (!next || next.startsWith('-')) {
          throw new Error('--test requires a test pattern');
        }
        args.tests.push(next);
        index += 1;
        break;
      }
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (!args.verify && !args.runtime && args.tests.length === 0 && !args.help) {
    args.verify = true;
  }

  return args;
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function runCommand(repoRoot, command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    command: [command, ...commandArgs].join(' '),
    passed: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function runVerify(repoRoot) {
  const result = runCommand(repoRoot, 'bun', ['run', 'verify', '--', '--json', '--quiet']);
  const data = parseJson(result.stdout);

  return {
    passed: result.passed && data !== null && data.passed !== false,
    status: result.status,
    failed_checks: data
      ? [
        data.review?.passed === false ? 'review' : null,
        data.db?.passed === false ? 'db guard' : null,
      ].filter(Boolean)
      : ['verify output parse'],
    data,
    stderr: result.stderr.trim(),
  };
}

function runRuntime(repoRoot) {
  const result = runCommand(repoRoot, 'bun', ['run', 'railway:logs', '--', '--errors', '--json']);
  const data = parseJson(result.stdout);
  const errors = Number(data?.errors || 0) + Number(data?.httpErrors || 0);

  return {
    passed: result.passed && errors === 0,
    status: result.status,
    errors,
    data,
    stderr: result.stderr.trim(),
  };
}

function runTest(repoRoot, pattern) {
  const result = runCommand(repoRoot, 'npx', ['jest', pattern, '--runInBand']);
  const passedMatch = result.stdout.match(/Tests:\s+(\d+) passed/);
  const failedMatch = result.stdout.match(/Tests:\s+(\d+) failed/);

  return {
    pattern,
    passed: result.passed,
    status: result.status,
    passed_count: passedMatch ? Number(passedMatch[1]) : null,
    failed_count: failedMatch ? Number(failedMatch[1]) : null,
    stderr: result.stderr.trim(),
  };
}

function getVerdict(result) {
  const checks = [
    result.verify ? result.verify.passed : true,
    result.runtime ? result.runtime.passed : true,
    ...result.tests.map((test) => test.passed),
  ];

  return checks.every(Boolean) ? 'CONFIRMED' : 'NOT_CONFIRMED';
}

function writeConfirmationEvidence(repoRoot, result, state) {
  if (result.verify) {
    appendEvidenceEvent(repoRoot, {
      type: result.verify.passed ? 'verify.pass' : 'verify.fail',
      source: 'confirm',
      question: state?.query || null,
      action: 'bun run verify',
      status: result.verify.passed ? 'pass' : 'fail',
      confidence_delta: result.verify.passed ? 0.15 : -0.15,
      details: {
        failed_checks: result.verify.failed_checks || [],
        status: result.verify.status,
        summary: result.verify.passed ? 'verify passed' : 'verify failed',
      },
    }, { requireMirror: true });
  }

  if (result.runtime) {
    appendEvidenceEvent(repoRoot, {
      type: result.runtime.passed ? 'runtime.clean' : 'runtime.error',
      source: 'confirm',
      question: state?.query || null,
      action: 'bun run railway:logs -- --errors --json',
      status: result.runtime.passed ? 'clean' : 'error',
      confidence_delta: result.runtime.passed ? 0.05 : -0.15,
      details: {
        errors: result.runtime.errors,
        status: result.runtime.status,
        summary: result.runtime.passed ? 'runtime logs clean' : 'runtime errors recorded',
      },
    }, { requireMirror: true });
  }

  for (const test of result.tests) {
    appendEvidenceEvent(repoRoot, {
      type: test.passed ? 'test.pass' : 'test.fail',
      source: 'confirm',
      question: state?.query || null,
      action: `npx jest ${test.pattern} --runInBand`,
      status: test.passed ? 'pass' : 'fail',
      confidence_delta: test.passed ? 0.10 : -0.15,
      details: {
        pattern: test.pattern,
        passed_count: test.passed_count,
        failed_count: test.failed_count,
        status: test.status,
        summary: test.passed ? 'targeted test passed' : 'targeted test failed',
      },
    }, { requireMirror: true });
  }
}

function printHuman(result) {
  writeStdout('confirm:');

  if (result.verify) {
    writeStdout(`  verify: ${result.verify.passed ? 'pass' : 'fail'}`);
    for (const check of result.verify.failed_checks || []) {
      writeStdout(`    - failed: ${check}`);
    }
  }

  for (const test of result.tests) {
    writeStdout(`  tests: ${test.passed ? 'pass' : 'fail'} - ${test.pattern}`);
  }

  if (result.runtime) {
    writeStdout(`  runtime: ${result.runtime.passed ? 'pass' : 'fail'} (${result.runtime.errors} errors)`);
  }

  writeStdout(`  verdict: ${result.verdict}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  const result = {
    verify: args.verify ? runVerify(repoRoot) : null,
    runtime: args.runtime ? runRuntime(repoRoot) : null,
    tests: args.tests.map((pattern) => runTest(repoRoot, pattern)),
    updated_at: new Date().toISOString(),
  };
  result.verdict = getVerdict(result);

  const state = readExploreState(repoRoot);
  writeConfirmationEvidence(repoRoot, result, state);
  if (state) {
    writeExploreState(repoRoot, {
      ...state,
      confirmation: result,
      updated_at: new Date().toISOString(),
    });
  }

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  if (result.verdict !== 'CONFIRMED') {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (err /* unknown */) {
  writeStderr(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
