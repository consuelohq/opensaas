#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_RULES = 'packages/os/test-selection.rules.json';
const DEFAULT_REGISTRY = 'packages/os/test-selection.registry.json';
const REPORT_DIR = '/tmp/opensaas-test-reports';
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache', '.task', 'tmp', 'node-jiti', '.astro']);
const TEST_FILE_RE = /(^|\/)(__tests__|tests|test|spec|e2e|integration|unit)(\/|$)|\.(test|spec|e2e|integration)\.[cm]?[jt]sx?$/i;
const JS_TS_RE = /\.[cm]?[jt]sx?$/i;

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function walk(root, visitor, current = root) {
  let entries;
  try { entries = fs.readdirSync(current, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const file = path.join(current, entry.name);
    if (entry.isDirectory()) walk(root, visitor, file);
    else visitor(file, rel(root, file));
  }
}

function groupFor(file) {
  const parts = file.split('/');
  if (parts[0] !== 'packages' || !parts[1]) return parts[0];

  const markerIndex = parts.findIndex((part, index) =>
    index > 1 && ['__tests__', 'tests', 'test', 'spec', 'e2e', 'integration', 'unit'].includes(part)
  );
  if (markerIndex > 2) return parts.slice(0, markerIndex).join('/');

  const dirnameParts = parts.slice(0, -1);
  if (dirnameParts.length > 2) return dirnameParts.join('/');
  return parts.slice(0, 2).join('/');
}

function groupCandidatesFor(file) {
  const dir = path.dirname(file).replace(/\\/g, '/');
  const parts = dir.split('/');
  if (parts[0] !== 'packages' || !parts[1]) return [parts[0]];

  const candidates = [];
  for (let size = 2; size <= parts.length; size += 1) {
    candidates.push(parts.slice(0, size).join('/'));
  }
  return candidates;
}

function kindFor(file) {
  if (file.includes('/__tests__/')) return '__tests__';
  if (/\.e2e\./i.test(file)) return 'e2e';
  if (/\.integration\./i.test(file)) return 'integration';
  if (/\.spec\./i.test(file)) return 'spec';
  if (/\.test\./i.test(file)) return 'test';
  if (file.includes('/tests/')) return 'tests-dir';
  if (file.includes('/test/')) return 'test-dir';
  return 'other';
}

function discoverTests(root) {
  const tests = [];
  walk(root, (_abs, file) => {
    if (JS_TS_RE.test(file) && TEST_FILE_RE.test(file)) {
      tests.push({ path: file, group: groupFor(file), kind: kindFor(file) });
    }
  });
  tests.sort((a, b) => a.path.localeCompare(b.path));
  return tests;
}

function projectRootFromProjectFile(file, json) {
  if (typeof json.root === 'string' && json.root) return json.root.replace(/\\/g, '/');
  return path.dirname(file).replace(/\\/g, '/');
}

function discoverProjects(root) {
  const projects = [];
  walk(root, (abs, file) => {
    if (path.basename(file) !== 'project.json') return;
    const json = readJson(abs);
    if (!json) return;
    const targets = json.targets || {};
    const testTargets = Object.keys(targets).filter((target) => /^(test|test:|jest$|storybook:test)/.test(target));
    projects.push({
      name: json.name || path.basename(path.dirname(file)),
      root: projectRootFromProjectFile(file, json),
      file,
      testTargets,
      typecheck: Boolean(targets.typecheck),
      lint: Boolean(targets.lint),
    });
  });
  projects.sort((a, b) => a.root.localeCompare(b.root));
  return projects;
}

function discoverPackageScripts(root) {
  const packages = [];
  walk(root, (abs, file) => {
    if (path.basename(file) !== 'package.json') return;
    const json = readJson(abs);
    if (!json) return;
    const scripts = json.scripts || {};
    const testScripts = Object.fromEntries(Object.entries(scripts).filter(([key]) => /test|spec|e2e|vitest|jest|playwright/i.test(key)));
    if (Object.keys(testScripts).length === 0) return;
    packages.push({ name: json.name || path.basename(path.dirname(file)), root: path.dirname(file), file, scripts: testScripts });
  });
  packages.sort((a, b) => a.root.localeCompare(b.root));
  return packages;
}

function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    const next = glob[i + 1];
    if (char === '*' && next === '*') {
      out += '.*';
      i += 1;
    } else if (char === '*') {
      out += '[^/]*';
    } else if ('\\.+?^${}()|[]'.includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`^${out}$`);
}

function matchesPattern(file, pattern) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return file === prefix || file.startsWith(`${prefix}/`);
  }
  return globToRegExp(pattern).test(file);
}

function commandKey(command) {
  return JSON.stringify(command);
}

function normalizeRule(rule, source = 'explicit') {
  return {
    id: rule.id,
    source: rule.source || [],
    tests: rule.tests || [],
    critical: Boolean(rule.critical),
    reason: rule.reason || '',
    origin: source,
  };
}

function createAutoRules(tests, projects, packageScripts) {
  const testsByGroup = new Map();
  for (const test of tests) {
    const groups = new Set([test.group, ...groupCandidatesFor(test.path)]);
    for (const group of groups) {
      if (!testsByGroup.has(group)) testsByGroup.set(group, []);
      testsByGroup.get(group).push(test.path);
    }
  }
  const rules = [];
  for (const project of projects) {
    if (!project.testTargets.includes('test')) continue;
    if (!testsByGroup.has(project.root)) continue;
    rules.push(normalizeRule({
      id: `auto:${project.name}:test`,
      source: [`${project.root}/**`],
      tests: [{ name: `${project.name} test`, command: ['npx', 'nx', 'test', project.name] }],
      critical: false,
      reason: `Auto-discovered Nx test target for ${project.root}.`,
    }, 'auto'));
  }
  for (const pkg of packageScripts) {
    if (!pkg.scripts.test) continue;
    if (pkg.root === 'packages/os') continue;
    if (rules.some((rule) => rule.source.includes(`${pkg.root}/**`))) continue;
    if (!testsByGroup.has(pkg.root)) continue;
    rules.push(normalizeRule({
      id: `auto:${pkg.name}:package-test`,
      source: [`${pkg.root}/**`],
      tests: [{ name: `${pkg.name} package test`, command: ['bun', '--cwd', pkg.root, 'run', 'test'] }],
      critical: false,
      reason: `Auto-discovered package test script for ${pkg.root}.`,
    }, 'auto'));
  }
  return rules.sort((a, b) => a.id.localeCompare(b.id));
}

function loadRules(root, file = DEFAULT_RULES) {
  const rulesPath = path.resolve(root, file);
  const json = readJson(rulesPath, { rules: [] });
  return (json.rules || []).map((rule) => normalizeRule(rule, 'explicit'));
}

function buildRegistry(root) {
  const tests = discoverTests(root);
  const projects = discoverProjects(root);
  const packageScripts = discoverPackageScripts(root);
  const explicitRules = loadRules(root);
  const autoRules = createAutoRules(tests, projects, packageScripts);
  const rules = [...explicitRules, ...autoRules];
  const mappedTests = new Set();
  for (const test of tests) {
    if (rules.some((rule) => rule.source.some((pattern) => matchesPattern(test.path, pattern)))) {
      mappedTests.add(test.path);
    }
  }
  const byGroup = {};
  const byKind = {};
  for (const test of tests) {
    byGroup[test.group] = (byGroup[test.group] || 0) + 1;
    byKind[test.kind] = (byKind[test.kind] || 0) + 1;
  }
  return {
    version: 1,
    generatedBy: 'packages/os/scripts/test-selection.js',
    summary: {
      testFileCount: tests.length,
      mappedTestCount: mappedTests.size,
      unmappedTestCount: tests.length - mappedTests.size,
      ruleCount: rules.length,
      explicitRuleCount: explicitRules.length,
      autoRuleCount: autoRules.length,
      projectCount: projects.length,
      packageTestScriptCount: packageScripts.length,
      byGroup: Object.fromEntries(Object.entries(byGroup).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      byKind: Object.fromEntries(Object.entries(byKind).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    },
    rules,
    tests,
    unmappedTests: tests.filter((test) => !mappedTests.has(test.path)).map((test) => test.path),
    projects,
    packageScripts,
  };
}

function changedFiles(root, args) {
  const explicit = valuesFor(args, 'changed-file');
  if (explicit.length) return explicit;
  const base = valueFor(args, 'base') || 'origin/main';
  const committed = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' });
  const working = spawnSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' });
  const staged = spawnSync('git', ['diff', '--name-only', '--cached'], { cwd: root, encoding: 'utf8' });
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  const files = new Set();
  for (const result of [committed, working, staged, untracked]) {
    if (result.status !== 0) continue;
    for (const line of result.stdout.split(/\r?\n/)) if (line.trim()) files.add(line.trim());
  }
  return [...files].sort();
}

function isDocumentationJson(file) {
  return /(^|\/)docs\//i.test(file) || /\.schema\.json$/i.test(file);
}

function docsOnly(files) {
  return files.length > 0 && files.every((file) =>
    /(^|\/)(README|CHANGELOG)\.md$/i.test(file)
    || /\.(md|mdx|txt)$/i.test(file)
    || isDocumentationJson(file)
    || file.startsWith('.task/')
  );
}

function sourceCodeFiles(files) {
  return files.filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml)$/i.test(file) && !file.startsWith('.task/'));
}

function select(registry, files) {
  const matchedRules = [];
  const suites = [];
  const seen = new Set();
  for (const rule of registry.rules) {
    const matchedFiles = files.filter((file) => rule.source.some((pattern) => matchesPattern(file, pattern)));
    if (matchedFiles.length === 0) continue;
    matchedRules.push({ id: rule.id, critical: rule.critical, reason: rule.reason, matchedFiles, origin: rule.origin });
    for (const test of rule.tests) {
      const key = commandKey(test.command);
      if (seen.has(key)) continue;
      seen.add(key);
      suites.push({ ...test, ruleId: rule.id, critical: rule.critical });
    }
  }
  const criticalMatched = matchedRules.some((rule) => rule.critical);
  const codeFiles = sourceCodeFiles(files);
  let level = 'pass';
  let zeroSuiteReason = null;
  if (suites.length === 0) {
    if (docsOnly(files)) {
      zeroSuiteReason = 'changed files are docs or task metadata';
    } else if (criticalMatched) {
      level = 'fail';
      zeroSuiteReason = 'critical changed files matched test-selection rules but selected zero suites';
    } else if (codeFiles.length > 0) {
      level = 'warn';
      zeroSuiteReason = 'changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional';
    } else {
      zeroSuiteReason = 'no testable source files changed';
    }
  }
  return { changedFiles: files, matchedRules, selectedSuites: suites, level, zeroSuiteReason };
}
function testSuiteTimeoutMs() {
  const value = Number.parseInt(process.env.TEST_SUITE_TIMEOUT_MS || '', 10);
  return Number.isFinite(value) && value > 0 ? value : 300000;
}

function runSuites(root, suites) {
  const results = [];
  for (const suite of suites) {
    const started = Date.now();
    const result = spawnSync(suite.command[0], suite.command.slice(1), {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
      timeout: testSuiteTimeoutMs(),
    });
    const timedOut = result.error && result.error.code === 'ETIMEDOUT';
    const signaled = Boolean(result.signal);
    const output = `${result.stdout || ''}${result.stderr || ''}${timedOut ? '\n[test-selection] suite timed out\n' : ''}${signaled ? `\n[test-selection] suite terminated by signal ${result.signal}\n` : ''}`;
    results.push({
      name: suite.name,
      command: suite.command,
      ruleId: suite.ruleId,
      critical: suite.critical,
      status: result.status === 0 && !timedOut && !signaled ? 'passed' : 'failed',
      exitCode: result.status,
      signal: result.signal || null,
      error: result.error ? { code: result.error.code, message: result.error.message } : null,
      durationMs: Date.now() - started,
      outputTail: output.slice(-4000),
    });
  }
  return results;
}

function parseArgs(argv) {
  const [command = 'check', ...rest] = argv;
  const args = { _: [], command };
  for (let i = 0; i < rest.length; i += 1) {
    const raw = rest[i];
    if (!raw.startsWith('--')) { args._.push(raw); continue; }
    const [key, inline] = raw.slice(2).split('=', 2);
    if (['json', 'run', 'no-run'].includes(key)) args[key] = true;
    else {
      const value = inline !== undefined ? inline : rest[++i];
      if (args[key] === undefined) args[key] = value;
      else if (Array.isArray(args[key])) args[key].push(value);
      else args[key] = [args[key], value];
    }
  }
  return args;
}

function valueFor(args, key) {
  const value = args[key];
  return Array.isArray(value) ? value[0] : value;
}

function valuesFor(args, key) {
  const value = args[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function print(data, json) {
  if (json) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  else process.stdout.write(`${humanSummary(data)}\n`);
}

function humanSummary(data) {
  if (data.kind === 'registry') {
    return `test registry: ${data.summary.testFileCount} tests, ${data.summary.mappedTestCount} mapped, ${data.summary.unmappedTestCount} unmapped, ${data.summary.ruleCount} rules`;
  }
  if (data.kind === 'nightly') return `nightly report: ${data.markdownPath}`;
  return [
    `test selection: ${data.passed ? 'pass' : 'fail'} (${data.level})`,
    `changed files: ${data.changedFiles.length}`,
    `matched rules: ${data.matchedRules.map((rule) => rule.id).join(', ') || 'none'}`,
    `selected suites: ${data.selectedSuites.length}`,
    data.zeroSuiteReason ? `zero suite reason: ${data.zeroSuiteReason}` : null,
  ].filter(Boolean).join('\n');
}

function markdownReport(registry, check) {
  const lines = [];
  lines.push('# Test Selection Report');
  lines.push('');
  lines.push(`commit: ${spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim()}`);
  lines.push('');
  lines.push('## Registry');
  lines.push('');
  lines.push(`- discovered tests: ${registry.summary.testFileCount}`);
  lines.push(`- mapped tests: ${registry.summary.mappedTestCount}`);
  lines.push(`- unmapped tests: ${registry.summary.unmappedTestCount}`);
  lines.push(`- rules: ${registry.summary.ruleCount}`);
  lines.push('');
  if (check) {
    lines.push('## Current selection');
    lines.push('');
    lines.push(`- changed files: ${check.changedFiles.length}`);
    lines.push(`- matched rules: ${check.matchedRules.map((rule) => rule.id).join(', ') || 'none'}`);
    lines.push(`- selected suites: ${check.selectedSuites.length}`);
    if (check.zeroSuiteReason) lines.push(`- zero-suite reason: ${check.zeroSuiteReason}`);
  }
  lines.push('');
  lines.push('## Largest groups');
  lines.push('');
  for (const [group, count] of Object.entries(registry.summary.byGroup).slice(0, 20)) lines.push(`- ${group}: ${count}`);
  lines.push('');
  lines.push('## Unmapped sample');
  lines.push('');
  for (const file of registry.unmappedTests.slice(0, 50)) lines.push(`- ${file}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const root = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const registryPath = path.resolve(root, valueFor(args, 'registry') || DEFAULT_REGISTRY);
  if (args.command === 'generate') {
    const registry = buildRegistry(root);
    const out = path.resolve(root, valueFor(args, 'out') || DEFAULT_REGISTRY);
    writeJson(out, registry);
    print({ kind: 'registry', path: path.relative(root, out), summary: registry.summary }, args.json);
    return;
  }
  const registry = fs.existsSync(registryPath) ? readJson(registryPath) : buildRegistry(root);
  if (args.command === 'nightly') {
    const outDir = valueFor(args, 'out-dir') || REPORT_DIR;
    fs.mkdirSync(outDir, { recursive: true });
    const check = { ...select(registry, changedFiles(root, args)), runResults: [] };
    const date = new Date().toISOString().slice(0, 10);
    const jsonPath = path.join(outDir, `nightly-${date}.json`);
    const markdownPath = path.join(outDir, `nightly-${date}.md`);
    const payload = { kind: 'nightly', registry: registry.summary, selection: check };
    writeJson(jsonPath, payload);
    fs.writeFileSync(markdownPath, markdownReport(registry, check));
    fs.copyFileSync(jsonPath, path.join(outDir, 'latest.json'));
    fs.copyFileSync(markdownPath, path.join(outDir, 'latest.md'));
    print({ ...payload, jsonPath, markdownPath, latestJsonPath: path.join(outDir, 'latest.json'), latestMarkdownPath: path.join(outDir, 'latest.md') }, args.json);
    return;
  }
  const files = changedFiles(root, args);
  const selected = select(registry, files);
  const run = args.run && !args['no-run'];
  const runResults = run ? runSuites(root, selected.selectedSuites) : [];
  const failedSuites = runResults.filter((result) => result.status !== 'passed');
  const passed = selected.level !== 'fail' && failedSuites.length === 0;
  const result = { kind: 'selection', passed, ...selected, run, runResults, failedSuites };
  print(result, args.json);
  if (!passed) process.exit(1);
}

if (require.main === module) main();
