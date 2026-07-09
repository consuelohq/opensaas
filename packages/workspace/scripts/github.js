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
const SAMPLE_LIMIT = 12;
const TEXT_PREVIEW_LIMIT = 4000;
const BODY_PREVIEW_LIMIT = 600;
const MESSAGE_PREVIEW_LIMIT = 240;
const COMPACT_SCALAR_LIMIT = 24;

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

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function jsonChars(value) {
  if (value === null || value === undefined) return 0;
  try { return JSON.stringify(value).length; } catch { return 0; }
}

function previewText(value, limit = TEXT_PREVIEW_LIMIT) {
  const text = String(value || '').replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
  return {
    text: text.length > limit ? `${text.slice(0, limit)}... truncated ${text.length - limit} chars` : text,
    chars: text.length,
    truncated: text.length > limit,
    omittedChars: Math.max(0, text.length - limit),
  };
}

function compactScalarObject(value, limit = COMPACT_SCALAR_LIMIT) {
  if (!isObject(value)) return value;
  const entries = Object.entries(value);
  const compact = {};
  let used = 0;
  for (const [key, entryValue] of entries) {
    if (used >= limit) break;
    if (entryValue === null || ['string', 'number', 'boolean'].includes(typeof entryValue)) {
      compact[key] = typeof entryValue === 'string' ? previewText(entryValue, MESSAGE_PREVIEW_LIMIT).text : entryValue;
      used += 1;
    }
  }
  return compact;
}

function sampleArray(items, mapper, limit = SAMPLE_LIMIT) {
  const array = asArray(items);
  const sample = array.slice(0, limit).map(mapper);
  return {
    total: array.length,
    sample,
    truncated: array.length > limit,
    omitted: Math.max(0, array.length - limit),
  };
}

function checkState(check) {
  return String(check.conclusion || check.state || check.status || '').toUpperCase();
}

function isFailedCheck(check) {
  return ['FAILURE', 'FAILED', 'ERROR', 'CANCELLED', 'TIMED_OUT'].includes(checkState(check));
}

function isPendingCheck(check) {
  return ['PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED', 'REQUESTED', 'WAITING'].includes(checkState(check));
}

function compactUser(value) {
  if (typeof value === 'string') return { login: value };
  if (!isObject(value)) return null;
  return compactScalarObject(value, 6);
}

function compactCheck(value) {
  const check = isObject(value) ? value : {};
  return {
    name: check.name || check.workflow || '',
    state: check.state || check.conclusion || check.status || '',
    bucket: check.bucket || '',
    workflow: check.workflow || '',
    event: check.event || '',
    link: check.link || check.url || check.detailsUrl || '',
    startedAt: check.startedAt || check.started_at || '',
    completedAt: check.completedAt || check.completed_at || '',
    description: previewText(check.description || check.summary || '', MESSAGE_PREVIEW_LIMIT).text,
  };
}

function compactReview(value) {
  const review = isObject(value) ? value : {};
  return {
    id: review.id || review.databaseId || '',
    state: review.state || '',
    author: compactUser(review.author || review.user),
    submittedAt: review.submittedAt || review.submitted_at || '',
    body: previewText(review.body || '', BODY_PREVIEW_LIMIT).text,
    bodyChars: String(review.body || '').length,
  };
}

function compactFile(value) {
  const file = isObject(value) ? value : {};
  return {
    path: file.path || file.filename || '',
    status: file.status || '',
    additions: typeof file.additions === 'number' ? file.additions : undefined,
    deletions: typeof file.deletions === 'number' ? file.deletions : undefined,
    changes: typeof file.changes === 'number' ? file.changes : undefined,
    previousFilename: file.previousFilename || file.previous_filename || undefined,
    patchChars: typeof file.patch === 'string' ? file.patch.length : undefined,
  };
}

function compactPr(value) {
  const data = isObject(value) ? value : {};
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
      isDraft: Boolean(data.isDraft),
    },
    author: compactUser(data.author),
  };
}

function checkSummary(checks) {
  const array = asArray(checks);
  return {
    total: array.length,
    failed: array.filter((check) => isFailedCheck(isObject(check) ? check : {})).length,
    pending: array.filter((check) => isPendingCheck(isObject(check) ? check : {})).length,
  };
}

function compactPrViewPacket(data) {
  if (!isObject(data)) return { summary: {}, details: {} };
  const checks = asArray(data.statusCheckRollup);
  const reviews = asArray(data.latestReviews);
  const files = asArray(data.files);
  const checksDigest = checkSummary(checks);
  return {
    summary: {
      ...compactPr(data),
      checks: checksDigest,
      reviews: { total: reviews.length },
      files: { total: files.length },
      ready: data.state === 'OPEN'
        && checksDigest.failed === 0
        && checksDigest.pending === 0
        && data.mergeStateStatus !== 'DIRTY',
    },
    details: {
      checks: sampleArray(checks, compactCheck),
      reviews: sampleArray(reviews, compactReview),
      files: sampleArray(files, compactFile),
    },
  };
}

function compactListPacket(data, mapper, summary = {}) {
  return {
    summary: { total: asArray(data).length, ...summary },
    details: { items: sampleArray(data, mapper) },
  };
}

function compactComparePacket(data) {
  if (!isObject(data)) return { summary: {}, details: {} };
  const commits = asArray(data.commits);
  const files = asArray(data.files);
  return {
    summary: {
      status: data.status,
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
      totalCommits: data.total_commits,
      commits: { total: commits.length },
      files: { total: files.length },
      url: data.html_url || data.url,
    },
    details: {
      commits: sampleArray(commits, (commit) => {
        const item = isObject(commit) ? commit : {};
        const nestedCommit = isObject(item.commit) ? item.commit : {};
        return {
          sha: item.sha,
          url: item.html_url || item.url,
          message: previewText(nestedCommit.message || item.message || '', MESSAGE_PREVIEW_LIMIT).text,
          author: compactUser(nestedCommit.author || item.author),
        };
      }),
      files: sampleArray(files, compactFile),
    },
  };
}

function compactDiffPacket(stdout) {
  return {
    summary: { textChars: String(stdout || '').length },
    details: { text: previewText(stdout) },
  };
}

function compactUnknownPacket(data) {
  if (Array.isArray(data)) return compactListPacket(data, compactScalarObject);
  if (typeof data === 'string') return compactDiffPacket(data);
  if (isObject(data)) {
    return {
      summary: compactScalarObject(data),
      details: { keys: Object.keys(data).slice(0, COMPACT_SCALAR_LIMIT) },
    };
  }
  return { summary: {}, details: {} };
}

function compactGithubData(operation, data, stdout) {
  switch (operation) {
    case 'pr.view': return compactPrViewPacket(data);
    case 'pr.checks': return compactListPacket(data, compactCheck, checkSummary(data));
    case 'pr.reviews': return compactListPacket(data, compactReview);
    case 'pr.files': {
      const files = isObject(data) && Array.isArray(data.files) ? data.files : data;
      return compactListPacket(files, compactFile);
    }
    case 'pr.diff': return compactDiffPacket(stdout || (typeof data === 'string' ? data : ''));
    case 'pr.list': return compactListPacket(data, compactPr);
    case 'branch.compare': return compactComparePacket(data);
    case 'repo.view': return compactUnknownPacket(data);
    case 'raw': return compactUnknownPacket(data);
    default: return compactUnknownPacket(data);
  }
}

function extraOutputFields(extra) {
  const allowed = ['fields', 'full', 'mergeMethod', 'reason'];
  const output = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(extra, key)) output[key] = extra[key];
  }
  return output;
}

function createGithubOutput(operation, args, commandResult, extra = {}) {
  const stdout = typeof commandResult.stdout === 'string' ? commandResult.stdout : '';
  const data = commandResult.data;
  const compact = compactGithubData(operation, data, stdout);
  const dataJsonChars = jsonChars(data);
  const packet = {
    schema: 'github.packet.v1',
    operation,
    repo: args.repo,
    dryRun: Boolean(args.dryRun),
    summary: compact.summary,
    details: compact.details,
    raw: {
      dataJsonChars,
      stdoutChars: stdout.length,
      dataOmitted: dataJsonChars > 0,
      stdoutOmitted: stdout.length > 0,
      note: dataJsonChars || stdout.length
        ? 'Raw GitHub payload omitted. This packet includes bounded summaries, counts, and samples.'
        : 'No raw GitHub payload was produced.',
    },
  };
  return {
    ok: true,
    operation,
    repo: args.repo,
    dryRun: Boolean(args.dryRun),
    command: commandResult.command,
    ...extraOutputFields(extra),
    summary: compact.summary,
    packet,
  };
}

function output(operation, args, commandResult, extra = {}) {
  writeStdout(JSON.stringify(createGithubOutput(operation, args, commandResult, extra), null, 2));
}

function fieldsFor(args, fallbackPreset = 'summary') {
  const preset = args.preset || fallbackPreset;
  const presetFields = PRESET_FIELDS[preset];
  if (!presetFields) throw new Error(`unknown github preset: ${preset}`);
  const fields = args.fields.length > 0 ? args.fields : presetFields;
  return Array.from(new Set(fields));
}

function prView(args) {
  const fields = fieldsFor(args, 'review');
  const result = gh(['pr', 'view', requirePr(args), '--repo', args.repo, '--json', fields.join(',')], { dryRun: args.dryRun });
  output(args.operation, args, result, { fields });
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

if (require.main === module) {
  main();
}

module.exports = {
  createGithubOutput,
};
