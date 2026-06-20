#!/usr/bin/env bun

// review.js — local code review: static checks + eslint + typecheck
// splits findings into "yours" (from your diff) vs "pre-existing"
// usage: bun run review [options]

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { getTrackedChanges } = require('./lib/git');
const { getNxBinary, getProjectsForFiles, getProjectsWithTarget } = require('./lib/nx-projects');
const { computeVerificationState } = require('./lib/verification');
const { beginReviewRun, finishReviewRun, makeReviewRunIdentity } = require('./lib/review-run-state');
const { linkTaskWorktreeNodeModules } = require('./lib/task-node-modules');
let outputCapture = null;
let activeReviewRun = null;

function writeStdout(s = '') {
  const value = `${s}\n`;
  if (outputCapture) {
    outputCapture.stdout += value;
    return;
  }
  process.stdout.write(value);
}

function writeStderr(s = '') {
  const value = `${s}\n`;
  if (outputCapture) {
    outputCapture.stderr += value;
    return;
  }
  process.stderr.write(value);
}

function startOutputCapture() {
  outputCapture = { stdout: '', stderr: '' };
}

function stopOutputCapture() {
  const captured = outputCapture || { stdout: '', stderr: '' };
  outputCapture = null;
  return captured;
}

function emitCapturedOutput(captured) {
  if (!captured) return;
  if (captured.stderr) process.stderr.write(captured.stderr);
  if (captured.stdout) process.stdout.write(captured.stdout);
}

function replayReviewResult(result) {
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
  process.exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 1;
}

const FINDING_JSON_SAMPLE_LIMIT = 20;
const FINDING_MESSAGE_PREVIEW_LIMIT = 500;

function shouldUseReviewRunState(args) {
  return Boolean((args.json || args.summaryJson) && !args.fix);
}

function beginStructuredReviewRun(root, branch, base, args) {
  const verificationState = computeVerificationState(root, branch);
  const identity = makeReviewRunIdentity({
    repoRoot: root,
    branch,
    base,
    verificationState,
    args,
  });

  return beginReviewRun(root, identity);
}

function printHelp() {
  const lines = [
    'usage: bun run review [options]',
    '',
    'run all code review checks on changed files.',
    '',
    'options:',
    '  --fix                auto-fix eslint issues',
    '  --all                check all files, not just changed',
    '  --base <ref>         compare against ref (default: auto-detect stream or origin/main)',
    '  --json               json output',
    '  --summary-json       compact semantic json output for agents',
    '  --quiet              only show failures',
    '  --no-tests           skip test suite',
    '  --strict             enable strictPropertyInitialization (shows hidden TS2564 errors)',
    '  --mine               scope to active task worktree (auto-detects from .task/current.json)',
    '  --help               show this help',
  ];
  lines.forEach((l) => writeStdout(l));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--fix': args.fix = true; break;
      case '--all': args.all = true; break;
      case '--base': args.base = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--summary-json': args.summaryJson = true; break;
      case '--quiet': args.quiet = true; break;
      case '--no-tests': args.noTests = true; break;
      case '--strict': args.strict = true; break;
      case '--mine': args.mine = true; break;
      case '--help': args.help = true; break;
      default:
        if (argv[i].startsWith('--')) throw new Error(`unknown flag: ${argv[i]}`);
    }
  }
  return args;
}

// --- git helpers ---

function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, ...opts }).trim();
  } catch {
    return '';
  }
}

function gitRoot() {
  return run('git', ['rev-parse', '--show-toplevel']);
}

function currentBranch() {
  return run('git', ['branch', '--show-current']);
}

function detectBase() {
  const branch = currentBranch();
  // task/dialer/foo → stream/dialer
  const taskMatch = branch.match(/^task\/([^/]+)\//);
  if (taskMatch) {
    const stream = `origin/stream/${taskMatch[1]}`;
    if (run('git', ['rev-parse', '--verify', stream])) return stream;
  }
  return 'origin/main';
}

function normalizeRepoPath(root, filePath) {
  const value = path.isAbsolute(filePath)
    ? path.relative(root, filePath)
    : filePath;

  return value.split(path.sep).join('/');
}

function isVendoredThirdPartyFile(filePath) {
  return filePath.includes('/upstream/') || filePath.includes('/vendor/');
}

function isReviewableFile(filePath) {
  return filePath.startsWith('packages/')
    && !isVendoredThirdPartyFile(filePath)
    && /\.(tsx?|jsx?|mjs|cjs)$/.test(filePath);
}

function addChangedFiles(files, args) {
  const output = run('git', args);
  for (const file of output.split('\n').filter(Boolean)) {
    files.add(file);
  }
}

function getChangedFiles(base) {
  const files = new Set();
  addChangedFiles(files, ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
  addChangedFiles(files, ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']);
  addChangedFiles(files, ['diff', '--name-only', '--diff-filter=ACMR', '--staged']);

  try {
    for (const change of getTrackedChanges(gitRoot())) {
      files.add(change.path);
    }
  } catch {
    // status output is advisory; diff output above covers committed ranges.
  }

  return [...files].filter(isReviewableFile).sort();
}

function addChangedLineNumbers(lines, args) {
  const diff = run('git', args);
  for (const line of diff.split('\n')) {
    const m = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (m) {
      const start = parseInt(m[1], 10);
      const count = m[2] ? parseInt(m[2], 10) : 1;
      for (let i = start; i < start + count; i++) lines.add(i);
    }
  }
}

function getChangedLineNumbers(base, file) {
  const lines = new Set();
  addChangedLineNumbers(lines, ['diff', '-U0', `${base}...HEAD`, '--', file]);
  addChangedLineNumbers(lines, ['diff', '-U0', 'HEAD', '--', file]);
  addChangedLineNumbers(lines, ['diff', '-U0', '--staged', '--', file]);
  return lines;
}

function getAllTsFiles(root) {
  return run('find', [
    root,
    '-path', '*/node_modules', '-prune',
    '-o', '-path', '*/dist', '-prune',
    '-o', '-name', '*.ts', '-print',
    '-o', '-name', '*.tsx', '-print',
    '-o', '-name', '*.js', '-print',
    '-o', '-name', '*.mjs', '-print',
    '-o', '-name', '*.cjs', '-print',
  ])
    .split('\n')
    .filter(Boolean)
    .map((file) => normalizeRepoPath(root, file))
    .filter(isReviewableFile);
}

// --- checks ---

function readFileLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split('\n');
}

function isTestFile(f) {
  return /__tests__|\.spec\.|\.test\./.test(f);
}

function isLoggerFile(f) {
  return f.includes('packages/cli/src/output.ts') || f.includes('packages/logger/src/');
}

function isReviewSelfFile(f) {
  return f === 'packages/workspace/scripts/review.js' || f === 'packages/workspace/scripts/ai-review.js';
}

function checkLogging(file, lines) {
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/console\.(log|error|warn|info|debug)\s*\(/.test(lines[i]) && !isLoggerFile(file)) {
      if (/eslint-disable/.test(lines[i])) continue;
      findings.push({ line: i + 1, rule: 'LOGGING', msg: 'console.* usage — use structured logger' });
    }
  }
  return findings;
}

function checkSentry(file, lines) {
  if (isTestFile(file)) return [];
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/res\s*\.\s*status\s*\(\s*[45]\d\d\s*\)|\.status\s*=\s*[45]\d\d|throw\s+new\s+Http/.test(lines[i])) {
      const window = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
      if (!/Sentry\.(capture|withScope)/.test(window)) {
        findings.push({ line: i + 1, rule: 'SENTRY', msg: 'HTTP error without Sentry tracking' });
      }
    }
  }
  return findings;
}

function checkPhoneNorm(file, lines) {
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\.phone\s*[!=]==|\.phoneNumber\s*[!=]==/.test(lines[i])) {
      if (/normalizePhone/.test(lines[i])) continue;
      findings.push({ line: i + 1, rule: 'PHONE_NORM', msg: 'phone comparison without normalizePhone()' });
    }
  }
  return findings;
}

function checkSqlParam(file, lines) {
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\.query\s*\(\s*`/.test(lines[i])) {
      findings.push({ line: i + 1, rule: 'SQL_PARAM', msg: 'template literal in SQL query — use parameterized queries' });
    }
  }
  return findings;
}

function checkErrorHandling(file, lines) {
  if (isTestFile(file) || isReviewSelfFile(file)) return [];
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/async\s+\w+|async\s*\(/.test(lines[i])) {
      // look for await within 30 lines
      const window = lines.slice(i, Math.min(i + 30, lines.length)).join('\n');
      if (/await\s/.test(window) && !/try\s*\{/.test(window) && !/\.catch\s*\(/.test(window)) {
        findings.push({ line: i + 1, rule: 'ERROR_HANDLING', msg: 'async function with await but no try/catch within 30 lines' });
      }
    }
  }
  return findings;
}

function checkTypeSafety(file, lines) {
  if (isReviewSelfFile(file)) return [];
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/:\s*any\b|as\s+any\b|<any>/.test(lines[i])) {
      if (/\/\/\s*HACK:/.test(lines[i]) || (i > 0 && /\/\/\s*HACK:/.test(lines[i - 1]))) continue;
      if (/eslint-disable/.test(lines[i])) continue;
      findings.push({ line: i + 1, rule: 'TYPE_SAFETY', msg: 'explicit any without // HACK: comment' });
    }
  }
  return findings;
}

function checkSecrets(file, lines) {
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/.test(lines[i])) {
      if (/process\.env|type\s|interface\s|:\s*string/.test(lines[i])) continue;
      findings.push({ line: i + 1, rule: 'SECRETS', msg: 'possible hardcoded secret' });
    }
  }
  return findings;
}

function checkTodoFixme(file, lines) {
  if (isReviewSelfFile(file)) return [];
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\bTODO\b|\bFIXME\b/.test(lines[i])) {
      if (/DEV-\d+/.test(lines[i])) continue;
      findings.push({ line: i + 1, rule: 'TODO_FIXME', msg: 'TODO/FIXME without ticket reference (DEV-123)' });
    }
  }
  return findings;
}

function checkImportSafety(file, lines) {
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/import\s+\*\s+as/.test(lines[i])) {
      if (/from\s+['"](?:fs|path|os|crypto|url|util|stream|events|child_process|@sentry)/.test(lines[i])) continue;
      findings.push({ line: i + 1, rule: 'IMPORT_SAFETY', msg: 'wildcard import — use named imports' });
    }
  }
  return findings;
}

function checkCatchTyping(file, lines) {
  if (isReviewSelfFile(file)) return [];
  if (!/\.tsx?$/.test(file)) return [];
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    // catch(err: any) — explicit any
    if (/catch\s*\(.*:\s*any\s*\)/.test(lines[i])) {
      if (/HACK/.test(lines[i])) continue;
      findings.push({ line: i + 1, rule: 'CATCH_TYPING', msg: 'catch(err: any) — use catch(err: unknown) with type guards' });
    }
    // bare catch(err) — no type annotation
    else if (/catch\s*\(\s*\w+\s*\)/.test(lines[i]) && !/catch\s*\(\s*\w+\s*:\s*(unknown|any)\s*\)/.test(lines[i])) {
      findings.push({ line: i + 1, rule: 'CATCH_TYPING', msg: 'bare catch(err) — use catch(err: unknown) with type guards' });
    }
  }
  return findings;
}

function checkOptionalImport(file, lines) {
  // check if file's package has peerDependencies and if they're imported at top level
  const findings = [];
  const pkgMatch = file.match(/^packages\/([^/]+)\//);
  if (!pkgMatch) return findings;

  const pkgJsonPath = `packages/${pkgMatch[1]}/package.json`;
  if (!fs.existsSync(pkgJsonPath)) return findings;

  let pkgJson;
  try { pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')); } catch { return findings; }
  const peers = Object.keys(pkgJson.peerDependencies || {});
  if (peers.length === 0) return findings;

  for (let i = 0; i < lines.length; i++) {
    for (const peer of peers) {
      if (new RegExp(`^import\\s.*from\\s+['"]${peer.replace('/', '\\/')}['"]`).test(lines[i])) {
        findings.push({ line: i + 1, rule: 'OPTIONAL_IMPORT', msg: `top-level import of peer dep ${peer} — use lazy await import()` });
      }
    }
  }
  return findings;
}

function checkStubHandler(file, lines) {
  if (!file.includes('/routes/')) return [];
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/handler:\s*async|handler:\s*\(/.test(lines[i])) {
      const body = lines.slice(i, Math.min(i + 15, lines.length)).join('\n');
      // skip if handler has real logic
      if (/await |if \(|try \{|\.call\(|\.get\(|\.post\(|\.query\(/.test(body)) continue;
      // skip if marked as stub
      if (/STUB|TODO|FIXME|placeholder|health/i.test(body)) continue;
      findings.push({ line: i + 1, rule: 'STUB_HANDLER', msg: 'handler with no real logic — implement or mark with // STUB:' });
    }
  }
  return findings;
}

function checkRouteOrder(file, lines) {
  if (!file.includes('/routes/')) return [];
  const findings = [];
  let prevWasParam = '';
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/path:\s*'([^']+)'/);
    if (!m) continue;
    const routePath = m[1];
    const prefix = routePath.replace(/\/[^/]*$/, '');
    if (/:/.test(routePath)) {
      prevWasParam = prefix;
    } else if (prevWasParam === prefix) {
      findings.push({ line: i + 1, rule: 'ROUTE_ORDER', msg: `'${routePath}' after param route — may be shadowed by /:param` });
    }
  }
  return findings;
}

function checkSpecCompliance() {
  const promptFile = '/tmp/kiro-last-prompt.txt';
  const confirmFile = '/tmp/kiro-spec-confirmed';
  if (!fs.existsSync(promptFile)) return [];
  if (fs.existsSync(confirmFile) && fs.statSync(confirmFile).mtimeMs > fs.statSync(promptFile).mtimeMs) return [];
  return [{ line: 0, rule: 'SPEC_COMPLIANCE', msg: 'spec prompt exists but not confirmed — echo "confirmed" > /tmp/kiro-spec-confirmed' }];
}

const ALL_CHECKS = [
  checkLogging, checkSentry, checkPhoneNorm, checkSqlParam,
  checkErrorHandling, checkTypeSafety, checkSecrets, checkTodoFixme,
  checkImportSafety, checkRouteOrder, checkCatchTyping, checkOptionalImport, checkStubHandler,
];

// --- eslint ---

function runEslint(files, fix) {
  if (files.length === 0) return [];
  const root = gitRoot();

  // group files by package
  const byPkg = {};
  for (const f of files) {
    const m = f.match(/^packages\/([^/]+)\//);
    if (m) {
      if (!byPkg[m[1]]) byPkg[m[1]] = [];
      byPkg[m[1]].push(f);
    }
  }

  const findings = [];
  for (const [pkg, pkgFiles] of Object.entries(byPkg)) {
    const config = `packages/${pkg}/eslint.config.mjs`;
    if (!fs.existsSync(config)) continue;

    const args = ['eslint', '--config', config, '--format', 'json', '--no-error-on-unmatched-pattern'];
    if (fix) args.push('--fix');
    args.push(...pkgFiles.filter((f) => fs.existsSync(f)));

    try {
      execFileSync('npx', args, { encoding: 'utf8', cwd: root, maxBuffer: 10 * 1024 * 1024 });
    } catch (err) {
      try {
        const results = JSON.parse(err.stdout || '[]');
        for (const result of results) {
          const relPath = path.relative(root, result.filePath);
          for (const msg of result.messages || []) {
            findings.push({
              file: relPath,
              line: msg.line || 0,
              rule: 'ESLINT',
              msg: `${msg.ruleId || 'parse-error'}: ${msg.message}`,
            });
          }
        }
      } catch {
        findings.push({ file: '', line: 0, rule: 'ESLINT', msg: `eslint failed for ${pkg}` });
      }
    }
  }

  return findings;
}

// --- typecheck ---

function runTypecheck(files) {
  const root = gitRoot();
  const findings = [];
  const nxPath = getNxBinary(root);

  if (!nxPath) {
    findings.push({ file: '', line: 0, rule: 'TYPECHECK', msg: 'nx not found — run yarn install or symlink node_modules' });
    return findings;
  }

  const projects = getProjectsWithTarget(root, files, 'typecheck');

  if (files.length > 0 && projects.length === 0) {
    findings.push({
      file: '',
      line: 0,
      rule: 'TYPECHECK',
      msg: "no projects with 'typecheck' target found (nx available)",
    });
    return findings;
  }

  for (const project of projects) {
    try {
      execFileSync(nxPath, ['typecheck', project.name], {
        encoding: 'utf8',
        cwd: root,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '');
      const errorLines = output.split('\n').filter((line) => /error TS\d+/.test(line));

      for (const errLine of errorLines) {
        const m = errLine.match(/([^(]+)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.*)/);
        if (m) {
          const relFile = path.relative(root, m[1].trim()).split(path.sep).join('/');
          findings.push({ file: relFile, line: parseInt(m[2], 10), rule: 'TYPECHECK', msg: `${m[3]}: ${m[4]}` });
        } else {
          const m2 = errLine.match(/([^:]+):(\d+):\d+\s*-\s*error\s+(TS\d+):\s*(.*)/);
          if (m2) {
            const relFile = path.relative(root, m2[1].trim()).split(path.sep).join('/');
            findings.push({ file: relFile, line: parseInt(m2[2], 10), rule: 'TYPECHECK', msg: `${m2[3]}: ${m2[4]}` });
          }
        }
      }

      if (errorLines.length === 0 && output.includes('error')) {
        findings.push({ file: '', line: 0, rule: 'TYPECHECK', msg: `typecheck failed for ${project.name}: ${output}` });
      }
    }
  }

  return findings;
}

// --- main ---

// --- tests ---

function runTests(files) {
  const root = gitRoot();

  // detect affected packages from changed files, or run all known test packages
  let packages;
  if (files.length > 0) {
    packages = [...new Set(files.map((f) => {
      const m = f.match(/^packages\/([^/]+)\//);
      return m ? m[1] : null;
    }).filter(Boolean))];
  } else {
    packages = ['api', 'dialer', 'twenty-server'];
  }

  // map to packages that have jest configs
  const testablePackages = packages.filter((pkg) =>
    fs.existsSync(path.join(root, 'packages', pkg, 'jest.config.mjs'))
  );

  const results = [];

  for (const pkg of testablePackages) {
    const configPath = `packages/${pkg}/jest.config.mjs`;
    const startTime = Date.now();

    try {
      const output = execFileSync('npx', [
        'jest', '--config', configPath, '--no-coverage', '--forceExit',
      ], {
        encoding: 'utf8',
        cwd: root,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 300000, // 5 min max per package
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      // parse summary from output
      const suitesMatch = output.match(/Test Suites:\s*(.*)/);
      const testsMatch = output.match(/Tests:\s*(.*)/);
      results.push({
        pkg,
        passed: true,
        elapsed,
        suites: suitesMatch ? suitesMatch[1].trim() : 'unknown',
        tests: testsMatch ? testsMatch[1].trim() : 'unknown',
        failures: [],
      });
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (err.killed) {
        writeStderr(`⚠ jest timed out for ${pkg} after ${elapsed}s — partial output below`);
      }
      const output = (err.stdout || '') + (err.stderr || '');
      const suitesMatch = output.match(/Test Suites:\s*(.*)/);
      const testsMatch = output.match(/Tests:\s*(.*)/);

      // extract failing test names
      const failures = [];
      const failMatches = output.matchAll(/FAIL\s+(.*\.(?:spec|test)\.tsx?)/g);
      for (const m of failMatches) {
        failures.push(m[1].trim());
      }

      results.push({
        pkg,
        passed: false,
        elapsed,
        suites: suitesMatch ? suitesMatch[1].trim() : 'unknown',
        tests: testsMatch ? testsMatch[1].trim() : 'unknown',
        failures,
      });
    }
  }

  return results;
}

function classifyFindings(allFindings, changedLines, base) {
  const yours = [];
  const preExisting = [];

  for (const f of allFindings) {
    if (!f.file || !changedLines.has(f.file)) {
      preExisting.push(f);
      continue;
    }
    const myLines = changedLines.get(f.file);
    if (myLines.size === 0 || myLines.has(f.line)) {
      yours.push(f);
    } else {
      preExisting.push(f);
    }
  }

  return { yours, preExisting };
}

function printFindings(label, findings, quiet) {
  if (findings.length === 0) {
    if (!quiet) writeStdout(`${label}: ✓ clean`);
    return;
  }

  writeStdout(`${label}: ${findings.length} issue(s)`);
  const byRule = groupFindingsByRule(findings);

  for (const [rule, items] of Object.entries(byRule)) {
    writeStdout(`  ${rule} (${items.length}):`);
    for (const item of items) {
      const loc = item.file ? `${item.file}:${item.line}` : "(project)";
      writeStdout(`    ${loc} — ${item.msg}`);
    }
  }
}

function groupFindingsByRule(findings) {
  const byRule = {};
  for (const finding of findings) {
    const rule = finding.rule || 'UNKNOWN';
    if (!byRule[rule]) byRule[rule] = [];
    byRule[rule].push(finding);
  }
  return byRule;
}

function findingId(owner, index) {
  const prefix = owner === 'your_change' ? 'your' : 'pre';
  return `${prefix}_finding_${String(index + 1).padStart(4, '0')}`;
}

function previewText(value, limit = FINDING_MESSAGE_PREVIEW_LIMIT) {
  const text = String(value || '').replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}... truncated ${text.length - limit} chars` : text;
}

function compactFinding(finding, index, owner) {
  const fullMessage = finding.msg || '';
  const message = previewText(fullMessage);
  return {
    id: findingId(owner, index),
    owner,
    rule: finding.rule || 'UNKNOWN',
    file: finding.file || '',
    line: finding.line || 0,
    message,
    messageChars: String(fullMessage).length,
    messageTruncated: message !== String(fullMessage || ''),
  };
}

function summarizeCompactFindings(findings) {
  const byRule = {};
  const byFile = {};
  for (const finding of findings) {
    byRule[finding.rule] = (byRule[finding.rule] || 0) + 1;
    const file = finding.file || '(project)';
    if (!byFile[file]) byFile[file] = { file, count: 0, rules: new Set() };
    byFile[file].count += 1;
    byFile[file].rules.add(finding.rule);
  }

  return {
    total: findings.length,
    byRule: Object.entries(byRule).map(([rule, count]) => ({ rule, count })),
    byFile: Object.values(byFile)
      .map((entry) => ({ file: entry.file, count: entry.count, rules: [...entry.rules].sort() }))
      .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)),
    sample: findings.slice(0, FINDING_JSON_SAMPLE_LIMIT),
    truncated: findings.length > FINDING_JSON_SAMPLE_LIMIT,
    omitted: Math.max(0, findings.length - FINDING_JSON_SAMPLE_LIMIT),
  };
}

function summarizeReviewTests(testResults) {
  const failed = testResults.filter((result) => !result.passed);
  return {
    totalSuites: testResults.length,
    passedSuites: testResults.length - failed.length,
    failedSuites: failed.length,
    failures: failed.map((result, index) => ({
      id: `suite_${String(index + 1).padStart(4, '0')}`,
      package: result.pkg,
      elapsed: result.elapsed,
      suites: result.suites,
      tests: result.tests,
      failureCount: Array.isArray(result.failures) ? result.failures.length : 0,
      failures: Array.isArray(result.failures) ? result.failures.slice(0, FINDING_JSON_SAMPLE_LIMIT) : [],
      truncated: Array.isArray(result.failures) && result.failures.length > FINDING_JSON_SAMPLE_LIMIT,
    })),
  };
}

function createSummaryJsonPayload({ base, branch, files, affectedProjects, yours, preExisting, testResults, confidenceResult }) {
  const yourFindings = yours.map((finding, index) => compactFinding(finding, index, 'your_change'));
  const preExistingFindings = preExisting.map((finding, index) => compactFinding(finding, index, 'pre_existing'));
  const testSummary = summarizeReviewTests(testResults);
  const checksRun = ['static_rules', 'eslint', 'typecheck', 'spec_compliance'];
  if (testResults.length > 0) checksRun.push('tests');

  return {
    schema: 'review.summary.v1',
    base,
    branch,
    files: files.length,
    affectedProjects,
    checksRun,
    summary: {
      yourIssues: yourFindings.length,
      preExistingIssues: preExistingFindings.length,
      failedTestSuites: testSummary.failedSuites,
      blockingIssues: yourFindings.length + testSummary.failedSuites,
    },
    mustFix: yourFindings,
    byRule: {
      yourChanges: summarizeCompactFindings(yourFindings).byRule,
      preExisting: summarizeCompactFindings(preExistingFindings).byRule,
    },
    byFile: {
      yourChanges: summarizeCompactFindings(yourFindings).byFile,
      preExisting: summarizeCompactFindings(preExistingFindings).byFile,
    },
    preExistingDigest: summarizeCompactFindings(preExistingFindings),
    testSummary,
    fullEvidence: {
      command: `bun run review -- --base ${base} --json`,
      note: 'Full raw findings remain available from review --json. Summary finding IDs are stable within this summary output and map by owner/rule/file/line/message.',
    },
    confidence: confidenceResult,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }
  const structuredOutput = args.json || args.summaryJson;

  // --mine: re-run review from the active task worktree
  if (args.mine) {
    const { listWorktrees } = require("./lib/git");
    const { readTaskMeta } = require("./lib/task-meta");
    const { resolveGitRoot } = require("./lib/paths");
    const repoRoot = resolveGitRoot(process.cwd());
    const requestedBranch = process.env.TASK_BRANCH;
    const requestedWorktree = process.env.TASK_WORKTREE;

    if (requestedWorktree) {
      if (!fs.existsSync(requestedWorktree)) {
        writeStderr(`task worktree not found: ${requestedWorktree}`);
        process.exitCode = 1;
        return;
      }
      writeStderr(`→ review scoped to: ${requestedWorktree}`);
      const passthrough = process.argv.slice(2).filter((argument) => argument !== "--mine");
      try {
        execFileSync(process.execPath, [__filename, ...passthrough], { cwd: requestedWorktree, stdio: "inherit" });
      } catch (error) { process.exitCode = error.status || 1; }
      return;
    }

    const worktrees = listWorktrees(repoRoot);
    const tasks = [];
    for (const wt of worktrees) {
      const meta = readTaskMeta(wt.path);
      if (!meta) continue;
      const taskBranch = meta.taskBranch || meta.branch || wt.branch;
      if (taskBranch !== wt.branch) continue;
      tasks.push({ path: wt.path, branch: taskBranch, meta });
    }
    if (tasks.length === 0) { writeStderr("no active task worktree found"); process.exitCode = 1; return; }

    let task = null;
    if (requestedBranch) {
      task = tasks.find((candidate) => candidate.branch === requestedBranch) || null;
      if (!task) {
        writeStderr(`no active task worktree found for ${requestedBranch}`);
        process.exitCode = 1;
        return;
      }
    } else {
      const currentDirectory = process.cwd();
      const matchingTask = tasks.find((candidate) =>
        currentDirectory === candidate.path ||
        currentDirectory.startsWith(`${candidate.path}${path.sep}`)
      ) || null;

      if (matchingTask) {
        task = matchingTask;
      } else {
        if (tasks.length > 1) { writeStderr("multiple active tasks — run from inside the task worktree or set TASK_BRANCH"); process.exitCode = 1; return; }
        task = tasks[0];
      }
    }

    const taskRoot = task.path;
    writeStderr(`→ review scoped to: ${taskRoot}`);
    const passthrough = process.argv.slice(2).filter((argument) => argument !== "--mine");
    try {
      execFileSync(process.execPath, [__filename, ...passthrough], { cwd: taskRoot, stdio: "inherit" });
    } catch (error) { process.exitCode = error.status || 1; }
    return;
  }
  const root = gitRoot();
  if (!root) throw new Error("not in a git repository");
  process.chdir(root);
  const mainRoot = run('git', ['worktree', 'list', '--porcelain']).split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.replace('worktree ', ''))[0];

  if (mainRoot && mainRoot !== root) {
    linkTaskWorktreeNodeModules({
      repoRoot: mainRoot,
      worktreePath: root,
      writeStderr: (message) => {
        if (!args.quiet && !structuredOutput) writeStdout(message);
      },
    });
  }

  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    writeStderr('node_modules not found - run yarn install or check main worktree');
  }

  const base = args.base || detectBase();
  const branch = currentBranch();

  let reviewRun = null;
  if (shouldUseReviewRunState(args)) {
    reviewRun = beginStructuredReviewRun(root, branch, base, args);
    if (reviewRun.mode === 'replay') {
      writeStderr(`→ review result reused for ${branch} (${reviewRun.identity.key.slice(0, 12)})`);
      replayReviewResult(reviewRun.result);
      return;
    }
    activeReviewRun = reviewRun;
    startOutputCapture();
  }

  if (!args.quiet && !structuredOutput) {
    writeStdout('review: ' + branch + ' vs ' + base);
    writeStdout('');
  }

  // get files
  const files = args.all ? getAllTsFiles(root) : getChangedFiles(base);

  const affectedProjects = getProjectsForFiles(root, files).map((project) => ({
    name: project.name,
    root: project.root,
    files: project.files,
  }));

  if (!args.quiet && !structuredOutput) writeStdout(`checking ${files.length} changed file(s)...`);
  if (!args.quiet && !structuredOutput && affectedProjects.length > 0) {
    writeStdout(`affected projects: ${affectedProjects.map((project) => project.name).join(', ')}`);
  }

  // get changed line numbers for yours/not-yours split
  const changedLines = new Map();
  for (const file of files) {
    changedLines.set(file, getChangedLineNumbers(base, file));
  }

  // run static checks on changed files
  const allFindings = [];
  const checkResults = {};
  for (const file of files) {
    const lines = readFileLines(file);
    for (const check of ALL_CHECKS) {
      const results = check(file, lines);
      const name = check.name.replace('check', '').replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
      if (!checkResults[name]) checkResults[name] = [];
      for (const r of results) {
        allFindings.push({ ...r, file });
        checkResults[name].push({ ...r, file });
      }
    }
  }

  // ensure all check names appear even if no files
  const checkNames = ['LOGGING', 'SENTRY', 'PHONE_NORM', 'SQL_PARAM', 'ERROR_HANDLING',
    'TYPE_SAFETY', 'SECRETS', 'TODO_FIXME', 'IMPORT_SAFETY', 'ROUTE_ORDER',
    'CATCH_TYPING', 'OPTIONAL_IMPORT', 'STUB_HANDLER'];
  for (const name of checkNames) {
    if (!checkResults[name]) checkResults[name] = [];
  }

  // print static check results
  if (!args.quiet && !structuredOutput) {
    writeStdout('');
    for (const name of checkNames) {
      const pad = name + ' '.repeat(Math.max(0, 18 - name.length));
      const count = checkResults[name].length;
      writeStdout(`  ${pad} ${count === 0 ? '✓ PASS' : `✗ FAIL (${count})`}`);
    }
  }

  // run eslint — always, on changed files or all
  if (!args.quiet && !structuredOutput) writeStdout('');
  if (!args.quiet && !structuredOutput) writeStdout('running eslint...');
  const eslintFiles = files.length > 0 ? files : getAllTsFiles(root);
  const eslintFindings = runEslint(eslintFiles, args.fix);
  allFindings.push(...eslintFindings);
  if (!args.quiet && !structuredOutput) {
    writeStdout(`  ${'ESLINT' + ' '.repeat(13)} ${eslintFindings.length === 0 ? '✓ PASS' : `✗ FAIL (${eslintFindings.length})`}`);
  }

  // run typecheck — always, on affected packages
  if (!args.quiet && !structuredOutput) writeStdout('running typecheck...');
  const typecheckFiles = files.length > 0 ? files : getAllTsFiles(root);
  const typecheckFindings = runTypecheck(typecheckFiles);
  allFindings.push(...typecheckFindings);
  if (!args.quiet && !structuredOutput) {
    writeStdout(`  ${'TYPECHECK' + ' '.repeat(10)} ${typecheckFindings.length === 0 ? '✓ PASS' : `✗ FAIL (${typecheckFindings.length})`}`);
  }

  // spec compliance (not per-file)
  const specFindings = checkSpecCompliance();
  allFindings.push(...specFindings.map((f) => ({ ...f, file: '' })));
  if (!args.quiet && !structuredOutput) {
    writeStdout(`  ${'SPEC_COMPLIANCE' + ' '.repeat(4)} ${specFindings.length === 0 ? '✓ PASS' : `✗ FAIL (${specFindings.length})`}`);
  }

  // confidence score — read from decision engine state if available
  let confidenceResult = null;
  try {
    const { readExploreState, updateBeliefsWithEvents } = require('./lib/state/explore-state');
    const { getEvidenceEvents } = require('./lib/state/evidence-log');
    const { computeConfidence } = require('./confidence-score');
    const state = readExploreState(root);
    if (state) {
      const events = getEvidenceEvents(root);
      const updated = updateBeliefsWithEvents(state, events);
      confidenceResult = computeConfidence(root, updated, events);
      if (!args.quiet && !structuredOutput) {
        const s = confidenceResult;
        const status = s.score >= 0.75 ? 'exploit' : s.score >= 0.55 ? 'gather more' : 'low';
        writeStdout(`  ${'CONFIDENCE' + ' '.repeat(8)} ${s.score.toFixed(2)} (${status})`);
        if (s.evidence_counts.top_files > 0) {
          writeStdout(`    read ${s.evidence_counts.read_top_files}/${s.evidence_counts.top_files} top files, ${s.evidence_counts.read_graph_files}/${s.evidence_counts.graph_files} graph files`);
        }
        if (s.uncertainties.length > 0) {
          writeStdout(`    uncertainty: ${s.uncertainties[0]}`);
        }
      }
    } else if (!args.quiet && !structuredOutput) {
      writeStdout(`  ${'CONFIDENCE' + ' '.repeat(8)} ⊘ no evidence (decision system not used)`);
    }
  } catch {
    if (!args.quiet && !structuredOutput) {
      writeStdout(`  ${'CONFIDENCE' + ' '.repeat(8)} ⊘ skipped (modules not available)`);
    }
  }

  // run tests — default on, skip with --no-tests
  let testResults = [];
  if (!args.noTests) {
    if (!args.quiet && !structuredOutput) writeStdout('running tests...');
    testResults = runTests(files);
    if (!args.quiet && !structuredOutput) {
      let totalPassed = 0;
      let totalFailed = 0;
      for (const r of testResults) {
        const icon = r.passed ? '✓' : '✗';
        const status = r.passed ? 'PASS' : 'FAIL';
        writeStdout(`  TESTS:${r.pkg.padEnd(16)} ${icon} ${status} (${r.elapsed}s) ${r.tests}`);
        if (!r.passed && r.failures.length > 0) {
          for (const f of r.failures) {
            writeStdout(`    FAIL ${f}`);
          }
          if (r.failures.length > 5) writeStdout(`    ... and ${r.failures.length - 5} more`);
        }
        if (r.passed) totalPassed++; else totalFailed++;
      }
      if (testResults.length > 0) {
        writeStdout(`  ${'TESTS' + ' '.repeat(13)} ${totalFailed === 0 ? `✓ PASS (${totalPassed} suites)` : `✗ FAIL (${totalFailed}/${testResults.length} suites failed)`}`);
      }
    }
  } else {
    if (!args.quiet && !structuredOutput) {
      writeStdout(`  ${'TESTS' + ' '.repeat(13)} ⊘ SKIPPED (--no-tests)`);
    }
  }

  // classify
  const { yours, preExisting } = classifyFindings(allFindings, changedLines, base);

  // include test failures in exit code
  const testsFailed = testResults.some((r) => !r.passed);

  if (args.json || args.summaryJson) {
    const fullPayload = { base, branch, files: files.length, affectedProjects, yours, preExisting, testResults, confidence: confidenceResult };
    const payload = args.summaryJson
      ? createSummaryJsonPayload({ base, branch, files, affectedProjects, yours, preExisting, testResults, confidenceResult })
      : fullPayload;
    writeStdout(JSON.stringify(payload, null, 2));
    if (reviewRun) {
      const captured = stopOutputCapture();
      finishReviewRun(reviewRun, { ...captured, exitCode: 0 });
      activeReviewRun = null;
      emitCapturedOutput(captured);
    }
    return;
  }

  writeStdout('');
  printFindings('YOUR CHANGES', yours, args.quiet);
  writeStdout('');
  printFindings('⚠ PRE-EXISTING (in your stream — you still own these)', preExisting, args.quiet);

  writeStdout('');
  const total = yours.length + preExisting.length;
  if (total === 0 && !testsFailed) {
    writeStdout('✓ all checks passed');

    // kick off ai review in tmux background if a PR exists
    try {
      const { findTaskMeta: findTaskMetaRecord } = require('./lib/task-meta');
      const taskRecord = findTaskMetaRecord(root, { currentBranch: branch });
      if (taskRecord?.data) {
        const prMatch = (taskRecord.data.prUrl || '').match(/\/pull\/(\d+)/);
        if (prMatch) {
          const prNum = prMatch[1];
          const aiScript = path.join(root, 'packages/workspace/scripts/ai-review.js');
          if (fs.existsSync(aiScript)) {
            try {
              execSync(`tmux new-session -d -s ai-review-${prNum} "cd ${root} && bun ${aiScript} -- ${prNum} 2>&1 | tee /tmp/ai-review-${prNum}.log"`, { stdio: 'ignore' });
              writeStdout(`→ ai review started in tmux (ai-review-${prNum})`);
            } catch {
              writeStdout('→ ai review: tmux not available, skipping background review');
            }
          }
        }
      }
    } catch { /* non-critical */ }
  } else {
    if (total > 0) {
      writeStdout(`${total} lint/type issue(s): ${yours.length} yours, ${preExisting.length} pre-existing`);
    }
    if (testsFailed) {
      const failedSuites = testResults.filter((r) => !r.passed).map((r) => r.pkg);
      writeStdout(`test failures in: ${failedSuites.join(', ')}`);
    }
    writeStdout('fix all issues in your stream before pushing.');
    process.exit(1);
  }
}

main().catch((err) => {
  let reported = false;
  if (activeReviewRun && outputCapture) {
    const captured = stopOutputCapture();
    const stderr = captured.stderr + err.message + '\n';
    finishReviewRun(activeReviewRun, {
      stdout: captured.stdout,
      stderr,
      exitCode: 1,
    });
    activeReviewRun = null;
    emitCapturedOutput({ stdout: captured.stdout, stderr });
    reported = true;
  } else if (outputCapture) {
    emitCapturedOutput(stopOutputCapture());
  }
  if (!reported) writeStderr(err.message);
  process.exit(1);
});
