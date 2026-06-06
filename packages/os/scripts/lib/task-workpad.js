const fs = require('fs');
const path = require('path');

const STARTER_ACCEPTANCE = 'Define explicit task acceptance criteria before coding';
const STARTER_PLAN = 'Read the relevant code and update this plan before editing';
const NONE_YET = '- none yet';
const OUTPUT_TAIL_LIMIT = 600;

function getTaskWorkpadPathFromMeta(worktreePath, taskMeta) {
  const taskBranch = taskMeta?.taskBranch || taskMeta?.branch || '';
  const parts = String(taskBranch).split('/');
  if (parts[0] === 'task' && parts[1] && parts[2]) {
    const area = String(taskMeta?.area || parts[1]).split('/').filter(Boolean).join('-');
    const slug = parts.slice(2).join('-');
    return path.join(worktreePath, '.task', area, slug, 'workpad.md');
  }
  return path.join(worktreePath, '.task', 'workpad.md');
}

function readWorkpad(worktreePath, taskMeta) {
  const workpadPath = getTaskWorkpadPathFromMeta(worktreePath, taskMeta);
  if (!fs.existsSync(workpadPath)) return { path: workpadPath, content: '' };
  return { path: workpadPath, content: fs.readFileSync(workpadPath, 'utf8') };
}

function writeWorkpad(workpadPath, content) {
  fs.mkdirSync(path.dirname(workpadPath), { recursive: true });
  fs.writeFileSync(workpadPath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}
function findSectionRange(content, heading) {
  const escapedHeading = String(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headerPattern = new RegExp(`^##\\s+${escapedHeading}\\s*\\n\\s*\\n`, 'im');
  const match = headerPattern.exec(content);
  if (!match) return null;
  const bodyStart = match.index + match[0].length;
  const nextHeadingPattern = /\n##\s+/g;
  nextHeadingPattern.lastIndex = bodyStart;
  const nextHeading = nextHeadingPattern.exec(content);
  const divider = content.indexOf('\n---\n', bodyStart);
  const candidates = [nextHeading ? nextHeading.index : -1, divider].filter((value) => value !== -1);
  const end = candidates.length ? Math.min(...candidates) : content.length;
  return { bodyStart, end };
}
function replaceSection(content, heading, nextContent) {
  const normalized = nextContent.endsWith('\n') ? nextContent : `${nextContent}\n`;
  const range = findSectionRange(content, heading);
  if (!range) {
    const separator = content.endsWith('\n') ? '' : '\n';
    return `${content}${separator}\n## ${heading}\n\n${normalized}`;
  }
  return `${content.slice(0, range.bodyStart)}${normalized}${content.slice(range.end)}`;
}

function extractSection(content, heading) {
  const range = findSectionRange(content, heading);
  if (!range) return '';
  return content.slice(range.bodyStart, range.end).trim();
}

function normalizeRepoPath(filePath) {
  return String(filePath || '').split(path.sep).join('/');
}

function parseFileSection(section) {
  const entries = [];
  for (const line of String(section || '').split('\n')) {
    const match = line.match(/^-\s+`([^`]+)`(\s+\(deleted\))?/);
    if (!match) continue;
    entries.push({ path: match[1], deleted: Boolean(match[2]) });
  }
  return entries;
}

function normalizeFileEvents(files) {
  return (files || [])
    .filter((file) => file && file.path && !String(file.path).startsWith('.task/'))
    .map((file) => ({ ...file, path: normalizeRepoPath(file.path) }));
}

function normalizeReadFiles(files) {
  return (files || [])
    .map((file) => (typeof file === 'string' ? file : file?.path))
    .filter(Boolean)
    .map(normalizeRepoPath)
    .filter((file) => !file.startsWith('.task/'));
}

function formatFileEntries(entries) {
  return entries.length
    ? entries.map((file) => `- \`${normalizeRepoPath(file.path)}\`${file.deleted ? ' (deleted)' : ''}`).join('\n')
    : NONE_YET;
}

function syncFilesChanged(worktreePath, taskMeta, files, options = {}) {
  const current = readWorkpad(worktreePath, taskMeta);
  const incoming = normalizeFileEvents(files);
  const existing = options.replace ? [] : [
    ...parseFileSection(extractSection(current.content || '', 'files changed')),
    ...parseFileSection(extractSection(current.content || '', 'workspace-owned: files changed')),
  ];
  const entries = Array.from(new Map([...existing, ...incoming]
    .map((file) => [normalizeRepoPath(file.path), file])).values())
    .sort((a, b) => normalizeRepoPath(a.path).localeCompare(normalizeRepoPath(b.path)));
  const body = formatFileEntries(entries);
  let content = current.content || '';
  content = replaceSection(content, 'files changed', body);
  content = replaceSection(content, 'workspace-owned: files changed', body);
  writeWorkpad(current.path, content);
  return { path: current.path, files: entries.map((file) => normalizeRepoPath(file.path)) };
}

function syncFilesRead(worktreePath, taskMeta, files, options = {}) {
  const current = readWorkpad(worktreePath, taskMeta);
  const incoming = normalizeReadFiles(files);
  const existing = options.replace ? [] : parseFileSection(extractSection(current.content || '', 'workspace-owned: files read')).map((file) => file.path);
  const entries = [...new Set([...existing, ...incoming])].sort();
  const body = entries.length ? entries.map((file) => `- \`${file}\``).join('\n') : NONE_YET;
  const next = replaceSection(current.content || '', 'workspace-owned: files read', body);
  writeWorkpad(current.path, next);
  return { path: current.path, files: entries };
}

function formatTime(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function activitySortKey(line) {
  const marker = String(line).slice(2, 21);
  return marker.length === 19 ? marker : '';
}

function normalizeActivityLines(section) {
  const seen = new Set();
  return String(section || '')
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item && item !== NONE_YET && item.startsWith('- '))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .sort((a, b) => activitySortKey(a).localeCompare(activitySortKey(b)));
}

function appendActivity(worktreePath, taskMeta, event) {
  const current = readWorkpad(worktreePath, taskMeta);
  const action = event?.action || 'update';
  const filePath = event?.filePath ? ` \`${normalizeRepoPath(event.filePath)}\`` : '';
  const detail = event?.detail ? ` ${event.detail}` : '';
  const line = `- ${formatTime()} ${action}:${filePath}${detail}`;
  const existing = extractSection(current.content || '', 'workspace-owned: activity log') || extractSection(current.content || '', 'activity log') || NONE_YET;
  const lines = normalizeActivityLines(existing);
  lines.push(line);
  const body = normalizeActivityLines(lines.join('\n')).slice(-50).join('\n') || NONE_YET;
  const next = replaceSection(current.content || '', 'workspace-owned: activity log', body);
  writeWorkpad(current.path, next);
  return { path: current.path, line };
}

function syncValidationEvidence(worktreePath, taskMeta, event) {
  const current = readWorkpad(worktreePath, taskMeta);
  const command = event?.command ? `\`${event.command}\`` : '`validation`';
  const status = event?.ok === false ? 'failed' : 'passed';
  const detail = event?.detail ? ` — ${event.detail}` : '';
  const line = `- ${formatTime()} ${command}: ${status}${detail}`;
  const existing = extractSection(current.content || '', 'workspace-owned: validation evidence')
    || extractSection(current.content || '', 'validation evidence')
    || NONE_YET;
  const lines = existing.split('\n').filter((item) => item.trim() && item.trim() !== NONE_YET);
  lines.push(line);
  const next = replaceSection(current.content || '', 'workspace-owned: validation evidence', lines.slice(-30).join('\n') || NONE_YET);
  writeWorkpad(current.path, next);
  return { path: current.path, line };
}

function outputTail(output) {
  const value = String(output || '').trim();
  if (!value) return '';
  return value.length > OUTPUT_TAIL_LIMIT ? value.slice(-OUTPUT_TAIL_LIMIT) : value;
}

function formatTddLine(event) {
  const command = event?.command ? `\`${event.command}\`` : '`test command`';
  const status = event?.ok === false ? 'failed' : 'passed';
  const exitCode = Number.isInteger(event?.exitCode) ? ` exit ${event.exitCode}` : '';
  const trace = event?.traceId ? ` trace: \`${event.traceId}\`` : '';
  const tail = outputTail(event?.output || event?.outputTail || event?.stderr || event?.stdout);
  return [
    `- ${formatTime()} ${command}: ${status}${exitCode}${trace}`,
    tail ? `  - output: ${tail.replace(/\s+/g, ' ').trim()}` : null,
  ].filter(Boolean).join('\n');
}

function syncTddEvidence(worktreePath, taskMeta, event) {
  const phase = event?.phase === 'green' ? 'green' : event?.phase === 'post' ? 'post' : 'red';
  const heading = phase === 'green'
    ? 'workspace-owned: TDD green evidence'
    : phase === 'post'
      ? 'workspace-owned: TDD post evidence'
      : 'workspace-owned: TDD red evidence';
  const current = readWorkpad(worktreePath, taskMeta);
  const existing = extractSection(current.content || '', heading) || NONE_YET;
  const lines = existing.split('\n').filter((item) => item.trim() && item.trim() !== NONE_YET);
  lines.push(formatTddLine(event));
  const next = replaceSection(current.content || '', heading, lines.slice(-10).join('\n') || NONE_YET);
  writeWorkpad(current.path, next);
  return { path: current.path, phase, heading };
}

function listField(items, formatter, empty = 'none') {
  const values = (items || []).map(formatter).filter(Boolean);
  return values.length ? values.map((item) => `\`${item}\``).join(', ') : empty;
}

function syncTestSelectionEvidence(worktreePath, taskMeta, selection) {
  const current = readWorkpad(worktreePath, taskMeta);
  const changedFiles = listField(selection?.changedFiles, (file) => file);
  const matchedRules = listField(selection?.matchedRules, (rule) => rule.id || rule.name || rule);
  const selectedSuites = listField(selection?.selectedSuites, (suite) => suite.name || suite.command?.join(' ') || suite);
  const runResults = (selection?.runResults || []).map((result) => {
    const name = result.name || result.command?.join(' ') || 'suite';
    return `\`${name}\` ${result.status || (result.passed ? 'passed' : 'failed')}`;
  });
  const failedSuites = listField(selection?.failedSuites, (suite) => suite.name || suite.command?.join(' ') || suite);
  const lines = [
    `- changed files: ${changedFiles}`,
    `- matched rules: ${matchedRules}`,
    `- selected suites: ${selectedSuites}`,
    runResults.length ? `- run results: ${runResults.join(', ')}` : '- run results: none',
    `- failed suites: ${failedSuites}`,
    selection?.zeroSuiteReason ? `- zero-suite reason: ${selection.zeroSuiteReason}` : null,
  ].filter(Boolean);
  const next = replaceSection(current.content || '', 'workspace-owned: test selection', lines.join('\n'));
  writeWorkpad(current.path, next);
  return { path: current.path };
}

function stripMarkdownNoise(value) {
  return String(value || '').replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').replace(/[-*[\]#\s]/g, '').trim().toLowerCase();
}

function sectionHasMeaningfulContent(content, heading) {
  const section = extractSection(content, heading);
  if (!section) return false;
  const normalized = stripMarkdownNoise(section);
  if (!normalized) return false;
  if (section.includes(STARTER_ACCEPTANCE) || section.includes(STARTER_PLAN)) return false;
  if (normalized === 'noneyet') return false;
  if (normalized === 'taskstartedupdatethisbeforepublish') return false;
  return true;
}

function hasAgentCheckpoint(content) {
  return /^##\s+(implementation checkpoint|final validation|findings|review checkpoint|debugging notes|handoff|summary|current status)\b/im.test(content);
}

function buildWorkpadMessage(workpadPath, missing) {
  return [
    'Workpad update needed before publishing.',
    '',
    `Workpad: ${workpadPath}`,
    `Missing: ${missing.join(', ')}`,
    '',
    'Update the scoped workpad with what changed, why it changed, validation run, and issues or follow-ups.',
    'Then rerun the publish command.',
    'Use --ack-workpad-incomplete only for emergency repair tasks or when Ko explicitly approved publishing without a complete workpad.',
  ].join('\n');
}

function checkWorkpadReady(worktreePath, taskMeta) {
  const current = readWorkpad(worktreePath, taskMeta);
  const content = current.content || '';
  if (!content.trim()) {
    const missing = ['workpad file'];
    return { ok: false, path: current.path, missing, message: buildWorkpadMessage(current.path, missing) };
  }
  const hasMeaningfulAgentSection = [
    'acceptance criteria', 'plan', 'current status', 'key decisions', 'notes for ko', 'issues and recovery', 'errors i ran into', 'test-first contract',
  ].some((heading) => sectionHasMeaningfulContent(content, heading));
  const ready = hasMeaningfulAgentSection || hasAgentCheckpoint(content);
  const missing = ready ? [] : ['one meaningful agent-authored workpad update'];
  return { ok: ready, path: current.path, missing, message: ready ? '' : buildWorkpadMessage(current.path, missing) };
}

function assertWorkpadReady(worktreePath, taskMeta, options = {}) {
  const readiness = checkWorkpadReady(worktreePath, taskMeta);
  if (!readiness.ok && !options.ackIncomplete) {
    const error = new Error(readiness.message);
    error.code = 'WORKPAD_NOT_CURRENT';
    error.readiness = readiness;
    throw error;
  }
  return readiness;
}

module.exports = {
  appendActivity,
  assertWorkpadReady,
  checkWorkpadReady,
  extractSection,
  getTaskWorkpadPathFromMeta,
  replaceSection,
  syncFilesChanged,
  syncFilesRead,
  syncTddEvidence,
  syncTestSelectionEvidence,
  syncValidationEvidence,
};
