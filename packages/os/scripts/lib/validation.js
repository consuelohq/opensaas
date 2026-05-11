const STREAM_PREFIX = 'stream/';
const TASK_PREFIX = 'task/';
const COMMIT_MSG_RE = /^(feat|fix|refactor|docs|test|chore|ci|perf|build|style|revert)(\([a-z0-9-]+\))?!?:\s.+/;

function normalizeArea(area) {
  return area.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/-{2,}/g, '-');
}

function getDefaultStreamBranch(area) {
  return `${STREAM_PREFIX}${normalizeArea(area)}`;
}

function getDefaultTaskBranch(area, title) {
  const slug = slugify(title);
  return `${TASK_PREFIX}${normalizeArea(area)}/${slug}`;
}

function isStreamBranchName(branch) {
  return typeof branch === 'string' && branch.startsWith(STREAM_PREFIX);
}

function isTaskBranchName(branch) {
  return typeof branch === 'string' && branch.startsWith(TASK_PREFIX);
}

function parseStreamBranchName(branch) {
  if (!isStreamBranchName(branch)) return null;
  const area = branch.slice(STREAM_PREFIX.length);
  return { area };
}

function parseTaskBranchName(branch) {
  if (!isTaskBranchName(branch)) return null;
  const rest = branch.slice(TASK_PREFIX.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex === -1) return { area: rest, slug: '' };
  return { area: rest.slice(0, slashIndex), slug: rest.slice(slashIndex + 1) };
}

function assertStreamBranchName(branch, area) {
  if (!isStreamBranchName(branch)) {
    throw new Error(`expected a stream branch (stream/*), received: ${branch}`);
  }
  if (area) {
    const parsed = parseStreamBranchName(branch);
    if (parsed.area !== normalizeArea(area)) {
      throw new Error(`stream branch area mismatch: expected ${normalizeArea(area)}, received ${parsed.area}`);
    }
  }
  return parseStreamBranchName(branch);
}

function assertTaskBranchName(branch, area) {
  if (!isTaskBranchName(branch)) {
    throw new Error(`expected a task branch (task/*), received: ${branch}`);
  }
  if (area) {
    const parsed = parseTaskBranchName(branch);
    if (parsed.area !== normalizeArea(area)) {
      throw new Error(`task branch area mismatch: expected ${normalizeArea(area)}, received ${parsed.area}`);
    }
  }
  return parseTaskBranchName(branch);
}

function assertCommitMessageFormat(message) {
  if (!COMMIT_MSG_RE.test(message)) {
    throw new Error(`commit message does not match conventional format: ${message}`);
  }
}

module.exports = {
  assertCommitMessageFormat,
  assertStreamBranchName,
  assertTaskBranchName,
  getDefaultStreamBranch,
  getDefaultTaskBranch,
  isStreamBranchName,
  isTaskBranchName,
  normalizeArea,
  parseStreamBranchName,
  parseTaskBranchName,
};
