#!/usr/bin/env bun

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

const { analyzeDbRisk } = require('./lib/db-guards');
const { getCurrentBranch, getRefSha, refExists, runGit } = require('./lib/git');
const { resolveGitRoot } = require('./lib/paths');
const { findTaskMeta } = require('./lib/task-meta');
const {
  computeVerificationState,
  getVerifyStampPath,
  writeVerifyStamp,
} = require('./lib/verification');
const {
  beginVerifyRun,
  finishVerifyRun,
  makeVerifyRunIdentity,
} = require('./lib/verify-run-state');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run verify -- [options]');
  writeStdout('');
  writeStdout('default behavior:');
  writeStdout('  1. detect the correct base ref from task metadata when available');
  writeStdout('  2. run bun run review against that base');
  writeStdout('  3. run db/migration/graphql guardrails on affected files');
  writeStdout('  4. run docs checks when docs files changed');
  writeStdout('  5. write task-scoped verify report metadata; publish-valid only when every gate passes');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --base <ref>           compare against ref (default: task branch stamp base, then stream, then origin/main)');
  writeStdout('  --no-review           skip bun run review and only run verify guardrails');
  writeStdout('  --no-db               skip db/migration/graphql guardrails');
  writeStdout('  --db-warn-only        report db guard errors as warnings');
  writeStdout('  --no-stamp            do not write task-scoped verify report metadata');
  writeStdout('  --review-arg <value>  pass one extra argument to bun run review; repeatable');
  writeStdout('  --json                output structured json');
  writeStdout('  --quiet               reduce human output');
  writeStdout('  --help                show this help');
}

function parseArgs(argv) {
  const args = {
    db: true,
    dbWarnOnly: false,
    json: false,
    quiet: false,
    review: true,
    reviewArgs: [],
    stamp: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];

    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = [
      '--db-warn-only',
      '--help',
      '--json',
      '--no-db',
      '--no-review',
      '--no-stamp',
      '--quiet',
    ].includes(flag);
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : argv[index + 1];

    if (!isBooleanFlag && (!value || value.startsWith('--'))) {
      throw new Error(`missing value for ${flag}`);
    }

    if (inlineValue === undefined && !isBooleanFlag) {
      index += 1;
    }

    switch (flag) {
      case '--base':
        args.base = value;
        break;
      case '--review-arg':
        args.reviewArgs.push(value);
        break;
      case '--no-review':
        args.review = false;
        break;
      case '--no-db':
        args.db = false;
        break;
      case '--db-warn-only':
        args.dbWarnOnly = true;
        break;
      case '--no-stamp':
        args.stamp = false;
        break;
      case '--json':
        args.json = true;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }

  return args;
}

function hasRef(repoRoot, ref) {
  return refExists(repoRoot, ref);
}

function remoteRefForBranch(branch) {
  return branch && branch.startsWith('origin/') ? branch : `origin/${branch}`;
}

function detectBase(repoRoot, args, branch, taskMeta) {
  if (args.base) {
    return args.base;
  }

  const candidates = [];

  if (taskMeta && taskMeta.data) {
    if (taskMeta.data.taskBranch) {
      candidates.push(remoteRefForBranch(taskMeta.data.taskBranch));
      candidates.push(taskMeta.data.taskBranch);
    }

    if (taskMeta.data.baseBranch) {
      candidates.push(remoteRefForBranch(taskMeta.data.baseBranch));
      candidates.push(taskMeta.data.baseBranch);
    }

    if (taskMeta.data.stream) {
      candidates.push(remoteRefForBranch(taskMeta.data.stream));
      candidates.push(taskMeta.data.stream);
    }
  }

  const taskMatch = branch.match(/^task\/([^/]+)\//);
  if (taskMatch) {
    candidates.push(`origin/stream/${taskMatch[1]}`);
    candidates.push(`stream/${taskMatch[1]}`);
  }

  candidates.push('origin/main');
  candidates.push('main');

  for (const candidate of candidates.filter(Boolean)) {
    if (hasRef(repoRoot, candidate)) {
      return candidate;
    }
  }

  return 'origin/main';
}

function addGitOutput(repoRoot, files, args) {
  try {
    const output = runGit(args, { cwd: repoRoot });
    for (const file of output.split('\n').filter(Boolean)) {
      files.add(file);
    }
  } catch {
    // some ranges are not available in fresh task worktrees; use the next source.
  }
}

function readChangedFiles(repoRoot, base) {
  const files = new Set();
  addGitOutput(repoRoot, files, ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
  addGitOutput(repoRoot, files, ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']);
  addGitOutput(repoRoot, files, ['diff', '--name-only', '--diff-filter=ACMR', '--staged']);

  try {
    const statusOutput = execFileSync('git', [
      '-c',
      'core.quotePath=false',
      'status',
      '--porcelain',
      '-z',
      '-uall',
      '--',
      '.',
      ':!node_modules',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    for (const entry of statusOutput.split('\0').filter(Boolean)) {
      const status = entry.slice(0, 2).trim();
      let file = entry.slice(3);

      if ((status.startsWith('R') || status.startsWith('C')) && file.includes(' -> ')) {
        file = file.split(' -> ').pop();
      }

      if (file && !file.startsWith('.task/')) {
        files.add(file);
      }
    }
  } catch {
    // advisory only; git diff output above is enough for committed changes.
  }

  return [...files].filter((file) => !file.startsWith('.task/')).sort();
}

function parseReviewJson(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

function runReview(repoRoot, base, args) {
  if (!args.review) {
    return {
      skipped: true,
      passed: true,
      status: 0,
      stdout: '',
      stderr: '',
      data: null,
    };
  }

  const reviewArgs = ['run', 'review', '--', '--base', base, '--json', '--quiet', ...args.reviewArgs];
  const result = spawnSync('bun', reviewArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const data = parseReviewJson(result.stdout || '');
  const reviewIssueCount = data
    ? (data.yours || []).length
      + (data.preExisting || []).length
      + (data.testResults || []).filter((testResult) => !testResult.passed).length
    : 1;

  return {
    skipped: false,
    passed: result.status === 0 && reviewIssueCount === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    data,
  };
}

function createDbResult(files, args) {
  if (!args.db) {
    return {
      skipped: true,
      passed: true,
      risks: [],
      groupedRisks: {},
      findings: [],
    };
  }

  const analysis = analyzeDbRisk(files);

  return {
    skipped: false,
    passed: args.dbWarnOnly || !analysis.hasFailures,
    warnOnly: args.dbWarnOnly,
    risks: analysis.risks,
    groupedRisks: analysis.groupedRisks,
    findings: analysis.findings,
  };
}

function isDocsCheckFile(filePath) {
  return filePath.startsWith('packages/consuelo-docs/') && (
    filePath.endsWith('.md') ||
    filePath.endsWith('.mdx') ||
    filePath.endsWith('.json') ||
    filePath.endsWith('.ts') ||
    filePath.endsWith('.js')
  );
}

function runDocsCommand(repoRoot, command) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    command,
    passed: result.status === 0,
    status: result.status,
    stdout: compactText(result.stdout || '', 4000),
    stderr: compactText(result.stderr || '', 4000),
  };
}

function createDocsResult(repoRoot, files) {
  const docsFiles = files.filter(isDocsCheckFile);
  if (docsFiles.length === 0) {
    return {
      skipped: true,
      passed: true,
      files: [],
      commands: [],
    };
  }

  const commands = [
    runDocsCommand(repoRoot, ['bun', 'run', '--cwd', 'packages/consuelo-docs', 'lint']),
    runDocsCommand(repoRoot, ['bun', 'packages/consuelo-docs/scripts/validate-os-docs.ts']),
  ];

  return {
    skipped: false,
    passed: commands.every((command) => command.passed),
    files: docsFiles,
    commands,
  };
}
function printHumanResult(result) {
  if (result.args.quiet) {
    return;
  }

  writeStdout(`verify: ${result.branch} vs ${result.base}`);
  writeStdout(`head: ${result.headSha.slice(0, 8)}`);
  writeStdout(`changed files: ${result.files.length}`);
  writeStdout(`review: ${result.review.skipped ? 'skipped' : result.review.passed ? 'pass' : 'fail'}`);
  writeStdout(`db guard: ${result.db.skipped ? 'skipped' : result.db.passed ? 'pass' : 'fail'}`);
  writeStdout(`docs check: ${result.docs.skipped ? 'skipped' : result.docs.passed ? 'pass' : 'fail'}`);

  for (const risk of result.db.risks) {
    writeStdout(`  ${risk.category}: ${risk.file}`);
  }

  for (const finding of result.db.findings) {
    writeStdout(`  ${finding.severity}: ${finding.rule} — ${finding.message}`);
    for (const file of finding.files || []) {
      writeStdout(`    - ${file}`);
    }
  }

  writeStdout(result.passed ? 'verify passed' : 'verify failed');

  if (result.stampPath) {
    writeStdout(`stamp: ${path.relative(result.repoRoot, result.stampPath)}`);
  }
}

function buildJsonResult(result) {
  return {
    branch: result.branch,
    base: result.base,
    headSha: result.headSha,
    files: result.files,
    review: {
      skipped: result.review.skipped,
      passed: result.review.passed,
      status: result.review.status,
      data: result.review.data,
      stderr: result.review.stderr,
    },
    db: result.db,
    docs: result.docs,
    passed: result.passed,
    publishValid: result.publishValid,
    mode: result.mode,
    stampPath: result.stampPath,
  };
}

function replayVerifyRun(replay) {
  process.stdout.write(replay.result.stdout || '');
  process.stderr.write(replay.result.stderr || '');
  if (replay.result.exitCode !== 0) {
    process.exit(replay.result.exitCode);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  process.chdir(repoRoot);

  const branch = getCurrentBranch(repoRoot);
  const taskMeta = findTaskMeta(repoRoot, { currentBranch: branch });
  const base = detectBase(repoRoot, args, branch, taskMeta);
  const files = readChangedFiles(repoRoot, base);
  const headSha = getRefSha(repoRoot, 'HEAD');
  const verificationState = computeVerificationState(repoRoot, branch);
  const verifyRun = args.json
    ? beginVerifyRun(repoRoot, makeVerifyRunIdentity({
      repoRoot,
      branch,
      base,
      headSha,
      changeHash: verificationState.changeHash,
      args,
    }))
    : null;

  if (verifyRun && verifyRun.mode === 'replay') {
    replayVerifyRun(verifyRun);
    return;
  }

  const review = runReview(repoRoot, base, args);
  const db = createDbResult(files, args);
  const docs = createDocsResult(repoRoot, files);
  const passed = review.passed && db.passed && docs.passed;
  const mode = args.review && args.db ? 'full' : 'partial';
  const publishValid = passed && mode === 'full' && !review.skipped && !db.skipped && db.warnOnly !== true;
  let stampPath = null;

  if (args.stamp && taskMeta) {
    const stamp = {
      result: passed ? 'pass' : 'fail',
      publishValid,
      mode,
      branch,
      base,
      headSha,
      changeHash: verificationState.changeHash,
      changedFiles: files,
      verifiedAt: new Date().toISOString(),
      review: {
        skipped: review.skipped,
        passed: review.passed,
      },
      db: {
        skipped: db.skipped,
        passed: db.passed,
        risks: db.risks,
        findings: db.findings,
        warnOnly: db.warnOnly === true,
      },
      docs: {
        skipped: docs.skipped,
        passed: docs.passed,
        files: docs.files,
        commands: docs.commands,
      },
      commandVersion: 1,
    };

    stampPath = writeVerifyStamp(repoRoot, stamp, taskMeta.data);
    stampPath = getVerifyStampPath(repoRoot, taskMeta.data);
  }

  const result = {
    repoRoot,
    args,
    branch,
    base,
    headSha,
    files,
    review,
    db,
    docs,
    passed,
    publishValid,
    mode,
    stampPath,
  };

  if (args.json) {
    const stdout = `${JSON.stringify(buildJsonResult(result), null, 2)}\n`;
    process.stdout.write(stdout);
    finishVerifyRun(verifyRun, { stdout, stderr: '', exitCode: passed ? 0 : 1 });
  } else {
    if (review.stderr && !review.passed) {
      writeStderr(review.stderr.trim());
    }

    printHumanResult(result);
  }

  if (!passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
