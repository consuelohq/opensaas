#!/usr/bin/env bun

const { execFileSync } = require('child_process');

const DEFAULT_REPO = 'consuelohq/opensaas';

const PRESET_FIELDS = {
  summary: ['number', 'title', 'url', 'headRefName', 'baseRefName', 'state'],
  review: ['number', 'title', 'url', 'headRefName', 'baseRefName', 'state', 'mergeStateStatus', 'reviewDecision', 'latestReviews', 'statusCheckRollup', 'headRefOid'],
  merge: ['number', 'title', 'url', 'headRefName', 'baseRefName', 'state', 'mergeStateStatus', 'reviewDecision', 'statusCheckRollup', 'isDraft', 'headRefOid'],
  checks: ['number', 'title', 'url', 'statusCheckRollup', 'headRefOid'],
  files: ['number', 'title', 'url', 'files'],
  full: ['number', 'title', 'url', 'headRefName', 'baseRefName', 'state', 'mergeStateStatus', 'reviewDecision', 'latestReviews', 'statusCheckRollup', 'headRefOid', 'isDraft', 'author', 'files'],
};

const CHECK_FIELDS = ['bucket', 'completedAt', 'description', 'event', 'link', 'name', 'startedAt', 'state', 'workflow'];

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function parseArgs(argv) {
  const args = { repo: DEFAULT_REPO, fields: [], rawArgs: [], json: false, dryRun: false };
  args.operation = argv[0];
  if (!args.operation || args.operation === '--help' || args.operation === '-h') {
    args.help = true;
    return args;
  }
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const next = argv[index + 1];
    switch (flag) {
      case '--repo': args.repo = next; index += 1; break;
      case '--pr': args.pr = Number(next); index += 1; break;
      case '--branch': args.branch = next; index += 1; break;
      case '--base': args.base = next; index += 1; break;
      case '--head': args.head = next; index += 1; break;
      case '--preset': args.preset = next; index += 1; break;
      case '--field': args.fields.push(next); index += 1; break;
      case '--limit': args.limit = Number(next); index += 1; break;
      case '--state': args.state = next; index += 1; break;
      case '--body': args.body = next; index += 1; break;
      case '--body-file': args.bodyFile = next; index += 1; break;
      case '--merge-method': args.mergeMethod = next; index += 1; break;
      case '--raw-arg': args.rawArgs.push(next); index += 1; break;
      case '--reason': args.reason = next; index += 1; break;
      case '--wait': args.wait = true; break;
      case '--squash': args.squash = true; break;
      case '--full': args.full = true; break;
      case '--json': args.json = true; break;
      case '--dry-run': args.dryRun = true; break;
      default:
        if (!String(flag).startsWith('--') && args.pr === undefined && /^\d+$/.test(flag)) args.pr = Number(flag);
        else throw new Error(`unknown github flag: ${flag}`);
    }
  }
  return args;
}

function printHelp() {
  writeStdout('github — typed GitHub facade for agents');
  writeStdout('');
  writeStdout('usage: bun run github -- <operation> [options]');
  writeStdout('');
  writeStdout('operations:');
  writeStdout('  pr.view       view one PR with preset or fields');
  writeStdout('  pr.checks     show PR checks');
  writeStdout('  pr.reviews    show PR reviews');
  writeStdout('  pr.files      show PR files');
  writeStdout('  pr.diff       show PR diff/stat');
  writeStdout('  pr.list       list PRs');
  writeStdout('  pr.merge      merge one PR');
  writeStdout('  branch.compare compare two branches');
  writeStdout('  repo.view     view repo metadata');
  writeStdout('  raw           raw gh args escape hatch; requires --reason');
}

function requirePr(args) {
  if (!Number.isInteger(args.pr) || args.pr <= 0) throw new Error(`${args.operation} requires --pr <number>`);
  return String(args.pr);
}

function gh(args, options = {}) {
  const command = ['gh', ...args];
  if (options.dryRun) return { command, stdout: '', data: null };
  const stdout = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim();
  return { command, stdout, data: parseMaybeJson(stdout) };
}

function parseMaybeJson(stdout) {
  if (!stdout) return null;
  try { return JSON.parse(stdout); } catch { return stdout; }
}

function output(operation, args, commandResult, extra = {}) {
  const value = {
    ok: true,
    operation,
    repo: args.repo,
    dryRun: Boolean(args.dryRun),
    command: commandResult.command,
    data: commandResult.data,
    stdout: typeof commandResult.data === 'string' ? commandResult.data : commandResult.stdout,
    ...extra,
  };
  writeStdout(JSON.stringify(value, null, 2));
}

function fieldsFor(args, fallbackPreset = 'summary') {
  const preset = args.preset || fallbackPreset;
  const presetFields = PRESET_FIELDS[preset];
  if (!presetFields) throw new Error(`unknown github preset: ${preset}`);
  const fields = args.fields.length > 0 ? args.fields : presetFields;
  return Array.from(new Set(fields));
}

function summarizePrReview(data) {
  if (!data || typeof data !== 'object') return data;
  const checks = Array.isArray(data.statusCheckRollup) ? data.statusCheckRollup : [];
  const failed = checks.filter((check) => ['FAILURE', 'FAILED', 'ERROR', 'CANCELLED', 'TIMED_OUT'].includes(String(check.conclusion || check.state || '').toUpperCase()));
  const pending = checks.filter((check) => ['PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED'].includes(String(check.state || check.conclusion || '').toUpperCase()));
  return {
    number: data.number,
    title: data.title,
    url: data.url,
    state: data.state,
    head: { branch: data.headRefName, sha: data.headRefOid },
    base: { branch: data.baseRefName },
    merge: {
      state: data.mergeStateStatus,
      reviewDecision: data.reviewDecision,
      ready: data.state === 'OPEN' && !failed.length && !pending.length && data.mergeStateStatus !== 'DIRTY',
    },
    checks: { total: checks.length, failed, pending },
    reviews: { latest: data.latestReviews || [] },
    raw: data,
  };
}

function prView(args) {
  const fields = fieldsFor(args, 'review');
  const result = gh(['pr', 'view', requirePr(args), '--repo', args.repo, '--json', fields.join(',')], { dryRun: args.dryRun });
  const summary = !args.dryRun && (args.preset || 'review') === 'review' ? summarizePrReview(result.data) : null;
  output(args.operation, args, result, { fields, summary });
}

function prChecks(args) {
  const result = gh(['pr', 'checks', requirePr(args), '--repo', args.repo, '--json', CHECK_FIELDS.join(',')], { dryRun: args.dryRun });
  output(args.operation, args, result, { fields: CHECK_FIELDS });
}

function prReviews(args) {
  const result = gh(['api', `repos/${args.repo}/pulls/${requirePr(args)}/reviews`], { dryRun: args.dryRun });
  output(args.operation, args, result);
}

function prFiles(args) {
  const result = gh(['pr', 'view', requirePr(args), '--repo', args.repo, '--json', 'files'], { dryRun: args.dryRun });
  output(args.operation, args, result);
}

function prDiff(args) {
  const command = ['pr', 'diff', requirePr(args), '--repo', args.repo];
  if (!args.full) command.push('--stat');
  const result = gh(command, { dryRun: args.dryRun });
  output(args.operation, args, result, { full: Boolean(args.full) });
}

function prList(args) {
  const command = ['pr', 'list', '--repo', args.repo, '--json', fieldsFor(args, 'summary').join(',')];
  if (args.limit) command.push('--limit', String(args.limit));
  if (args.state) command.push('--state', args.state);
  const result = gh(command, { dryRun: args.dryRun });
  output(args.operation, args, result);
}

function prMerge(args) {
  const command = ['pr', 'merge', requirePr(args), '--repo', args.repo];
  const method = args.mergeMethod || (args.squash ? 'squash' : 'merge');
  if (!['merge', 'squash', 'rebase'].includes(method)) throw new Error('--merge-method must be merge, squash, or rebase');
  command.push(`--${method}`);
  if (args.wait) command.push('--delete-branch=false');
  const result = gh(command, { dryRun: args.dryRun });
  output(args.operation, args, result, { mergeMethod: method });
}

function branchCompare(args) {
  if (!args.base || !args.head) throw new Error('branch.compare requires --base and --head');
  const result = gh(['api', `repos/${args.repo}/compare/${encodeURIComponent(args.base)}...${encodeURIComponent(args.head)}`], { dryRun: args.dryRun });
  output(args.operation, args, result);
}

function repoView(args) {
  const result = gh(['repo', 'view', args.repo, '--json', fieldsFor(args, 'summary').join(',')], { dryRun: args.dryRun });
  output(args.operation, args, result);
}

function raw(args) {
  if (!args.reason) throw new Error('github raw requires --reason explaining the missing typed operation');
  if (!args.rawArgs.length) throw new Error('github raw requires at least one --raw-arg');
  const result = gh(args.rawArgs, { dryRun: args.dryRun });
  output(args.operation, args, result, { reason: args.reason });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }
  switch (args.operation) {
    case 'pr.view': return prView(args);
    case 'pr.checks': return prChecks(args);
    case 'pr.reviews': return prReviews(args);
    case 'pr.files': return prFiles(args);
    case 'pr.diff': return prDiff(args);
    case 'pr.list': return prList(args);
    case 'pr.merge': return prMerge(args);
    case 'branch.compare': return branchCompare(args);
    case 'repo.view': return repoView(args);
    case 'raw': return raw(args);
    default: throw new Error(`unknown github operation: ${args.operation}`);
  }
}

main();
