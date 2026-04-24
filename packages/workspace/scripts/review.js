#!/usr/bin/env bun

// review.js — local code review: static checks + eslint + typecheck
// splits findings into "yours" (from your diff) vs "pre-existing"
// usage: bun run review [options]

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

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
    '  --quiet              only show failures',
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
      case '--quiet': args.quiet = true; break;
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

function getChangedFiles(base) {
  // try diff against base
  let files = run('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
  if (!files) {
    files = run('git', ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']);
  }
  if (!files) {
    files = run('git', ['diff', '--name-only', '--diff-filter=ACMR', '--staged']);
  }
  return files.split('\n').filter((f) => f && /\.tsx?$/.test(f) && f.startsWith('packages/'));
}

function getChangedLineNumbers(base, file) {
  // get line numbers that YOU changed
  const diff = run('git', ['diff', '-U0', `${base}...HEAD`, '--', file]);
  const lines = new Set();
  for (const line of diff.split('\n')) {
    const m = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (m) {
      const start = parseInt(m[1], 10);
      const count = m[2] ? parseInt(m[2], 10) : 1;
      for (let i = start; i < start + count; i++) lines.add(i);
    }
  }
  return lines;
}

function getAllTsFiles(root) {
  return run('find', [root, '-path', '*/node_modules', '-prune', '-o', '-path', '*/dist', '-prune', '-o', '-name', '*.ts', '-print', '-o', '-name', '*.tsx', '-print'])
    .split('\n')
    .filter((f) => f && f.startsWith('packages/'));
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
  if (isTestFile(file)) return [];
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
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    if (/catch\s*\(\s*\w+\s*\)/.test(lines[i]) && !/catch\s*\(\s*\w+\s*:\s*unknown\s*\)/.test(lines[i])) {
      findings.push({ line: i + 1, rule: 'CATCH_TYPING', msg: 'catch without : unknown type annotation' });
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
    if (/res\s*\.\s*(?:status\s*\(\s*200\s*\)\s*\.)?json\s*\(\s*\{/.test(lines[i])) {
      // check if it looks like a stub (hardcoded object with no variable references)
      const window = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
      if (/status:\s*['"]/.test(window) && !/STUB:/.test(window) && !/await|\.find|\.query|\.get/.test(window)) {
        findings.push({ line: i + 1, rule: 'STUB_HANDLER', msg: 'possible stub handler — return real data or 501' });
      }
    }
  }
  return findings;
}

const ALL_CHECKS = [
  checkLogging, checkSentry, checkPhoneNorm, checkSqlParam,
  checkErrorHandling, checkTypeSafety, checkSecrets, checkTodoFixme,
  checkImportSafety, checkCatchTyping, checkOptionalImport, checkStubHandler,
];

// --- eslint ---

function runEslint(files, fix) {
  if (files.length === 0) return [];
  const root = gitRoot();
  const args = ['eslint', '--format', 'json', '--no-error-on-unmatched-pattern'];
  if (fix) args.push('--fix');
  args.push(...files);

  try {
    execFileSync('npx', args, { encoding: 'utf8', cwd: root, maxBuffer: 10 * 1024 * 1024 });
    return [];
  } catch (err) {
    try {
      const results = JSON.parse(err.stdout || '[]');
      const findings = [];
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
      return findings;
    } catch {
      return [{ file: '', line: 0, rule: 'ESLINT', msg: 'eslint failed to run' }];
    }
  }
}

// --- typecheck ---

function runTypecheck(files) {
  const root = gitRoot();
  // detect affected packages
  const packages = [...new Set(files.map((f) => {
    const m = f.match(/^packages\/([^/]+)\//);
    return m ? m[1] : null;
  }).filter(Boolean))];

  // map package dirs to nx project names
  const projectMap = {
    'twenty-front': 'twenty-front',
    'twenty-server': 'twenty-server',
    'twenty-shared': 'twenty-shared',
    'api': '@consuelo/api',
    'dialer': '@consuelo/dialer',
    'coaching': '@consuelo/coaching',
    'contacts': '@consuelo/contacts',
    'analytics': '@consuelo/analytics',
    'cli': '@consuelo/cli',
    'sdk': '@consuelo/sdk',
    'metering': '@consuelo/metering',
    'logger': '@consuelo/logger',
  };

  const findings = [];

  // check if nx is available
  const nxPath = path.join(root, 'node_modules', '.bin', 'nx');
  if (!fs.existsSync(nxPath)) {
    findings.push({ file: '', line: 0, rule: 'TYPECHECK', msg: 'nx not found — run yarn install or symlink node_modules' });
    return findings;
  }

  for (const pkg of packages) {
    const project = projectMap[pkg];
    if (!project) continue;

    try {
      execFileSync('npx', ['nx', 'typecheck', project], {
        encoding: 'utf8',
        cwd: root,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '');
      // parse tsc errors: file(line,col): error TS1234: message
      const errorLines = output.split('\n').filter((l) => /error TS\d+/.test(l));
      for (const errLine of errorLines) {
        const m = errLine.match(/([^(]+)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.*)/);
        if (m) {
          const relFile = path.relative(root, m[1].trim());
          findings.push({ file: relFile, line: parseInt(m[2], 10), rule: 'TYPECHECK', msg: `${m[3]}: ${m[4]}` });
        } else {
          // try alternative format: file:line:col - error TS1234: message
          const m2 = errLine.match(/([^:]+):(\d+):\d+\s*-\s*error\s+(TS\d+):\s*(.*)/);
          if (m2) {
            const relFile = path.relative(root, m2[1].trim());
            findings.push({ file: relFile, line: parseInt(m2[2], 10), rule: 'TYPECHECK', msg: `${m2[3]}: ${m2[4]}` });
          }
        }
      }
      if (errorLines.length === 0 && output.includes('error')) {
        findings.push({ file: '', line: 0, rule: 'TYPECHECK', msg: `typecheck failed for ${project}: ${output.slice(0, 200)}` });
      }
    }
  }

  return findings;
}

// --- main ---

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
  // group by rule
  const byRule = {};
  for (const f of findings) {
    if (!byRule[f.rule]) byRule[f.rule] = [];
    byRule[f.rule].push(f);
  }

  for (const [rule, items] of Object.entries(byRule)) {
    writeStdout(`  ${rule} (${items.length}):`);
    for (const item of items.slice(0, 10)) {
      const loc = item.file ? `${item.file}:${item.line}` : '(project)';
      writeStdout(`    ${loc} — ${item.msg}`);
    }
    if (items.length > 10) {
      writeStdout(`    ... and ${items.length - 10} more`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  const root = gitRoot();
  if (!root) throw new Error('not in a git repository');
  process.chdir(root);

  const base = args.base || detectBase();
  const branch = currentBranch();

  if (!args.quiet) {
    writeStdout(`review: ${branch} vs ${base}`);
    writeStdout('');
  }

  // get files
  const files = args.all ? getAllTsFiles(root) : getChangedFiles(base);
  if (files.length === 0) {
    writeStdout('no changed .ts/.tsx files to review');
    return;
  }

  if (!args.quiet) writeStdout(`checking ${files.length} file(s)...`);

  // get changed line numbers for yours/not-yours split
  const changedLines = new Map();
  for (const file of files) {
    changedLines.set(file, getChangedLineNumbers(base, file));
  }

  // run static checks
  const allFindings = [];
  for (const file of files) {
    const lines = readFileLines(file);
    for (const check of ALL_CHECKS) {
      const results = check(file, lines);
      for (const r of results) {
        allFindings.push({ ...r, file });
      }
    }
  }

  // run eslint
  if (!args.quiet) writeStdout('running eslint...');
  const eslintFindings = runEslint(files, args.fix);
  allFindings.push(...eslintFindings);

  // run typecheck
  if (!args.quiet) writeStdout('running typecheck...');
  const typecheckFindings = runTypecheck(files);
  allFindings.push(...typecheckFindings);

  // classify
  const { yours, preExisting } = classifyFindings(allFindings, changedLines, base);

  if (args.json) {
    writeStdout(JSON.stringify({ base, branch, files: files.length, yours, preExisting }, null, 2));
    return;
  }

  writeStdout('');
  printFindings('YOUR CHANGES', yours, args.quiet);
  writeStdout('');
  printFindings('⚠ PRE-EXISTING (in your stream — you still own these)', preExisting, args.quiet);

  writeStdout('');
  const total = yours.length + preExisting.length;
  if (total === 0) {
    writeStdout('✓ all checks passed');
  } else {
    writeStdout(`${total} total issue(s): ${yours.length} yours, ${preExisting.length} pre-existing`);
    if (yours.length > 0) {
      writeStdout('fix your issues before pushing.');
    }
    process.exit(yours.length > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  writeStderr(err.message);
  process.exit(1);
});
