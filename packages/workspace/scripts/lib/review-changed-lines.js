const { execFileSync } = require('child_process');

const MAX_DIFF_FILES = 128;
const GIT_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;

// Attribute added/modified lines to the new (b/) path, including renames.
// Removed-only hunks have +N,0 and intentionally add no new line numbers.
function mergeZeroContextDiff(output, changedLines) {
  let currentFile = null;
  for (const line of String(output || '').split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4).trimEnd();
      currentFile = target.startsWith('b/') ? target.slice(2) : null;
      continue;
    }
    if (!currentFile || !changedLines.has(currentFile)) continue;
    const match = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    const lines = changedLines.get(currentFile);
    for (let number = start; number < start + count; number++) lines.add(number);
  }
}

// Three Git diffs per batch, rather than three per file.
// Keep a finite argv and preserve the original committed/unstaged/staged union.
function getChangedLinesByFile(base, files, { exec = execFileSync, batchSize = MAX_DIFF_FILES } = {}) {
  const changedLines = new Map(files.map((file) => [file, new Set()]));
  if (changedLines.size === 0) return changedLines;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error('batchSize must be a positive integer');

  const paths = [...changedLines.keys()];
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    for (const mode of [base + '...HEAD', 'HEAD', '--staged']) {
      const args = [
        '-c', 'core.quotePath=false', 'diff',
        '--no-ext-diff', '--no-color', '-U0', mode, '--', ...batch,
      ];
      try {
        const output = exec('git', args, {
          encoding: 'utf8',
          maxBuffer: GIT_OUTPUT_MAX_BUFFER,
        });
        mergeZeroContextDiff(output, changedLines);
      } catch (error) {
        throw new Error('Git diff failed while collecting changed lines (' + mode + '): ' + error.message);
      }
    }
  }
  return changedLines;
}

module.exports = { getChangedLinesByFile, mergeZeroContextDiff };
