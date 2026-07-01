const {
  getDefaultStreamBranch,
  normalizeArea,
  parseStreamBranchName,
  parseTaskBranchName,
} = require('./validation');

function normalizeWorkpadRow(row) {
  return {
    title: row.title,
    category: row.category,
    date: row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '',
    content: row.content || '',
  };
}

function hasStreamWorkpadEvidence(workpad, area, streamBranch) {
  const normalizedArea = normalizeArea(area);
  const expectedStream = streamBranch || getDefaultStreamBranch(normalizedArea);
  const content = `${workpad.title || ''}\n${workpad.content || ''}`;
  const branchMatches = content.match(/\b(?:task|stream)\/[a-z0-9-]+(?:\/[a-z0-9._-]+)?/g) || [];

  return branchMatches.some((branch) => {
    const taskBranch = parseTaskBranchName(branch);
    if (taskBranch) {
      return taskBranch.area === normalizedArea;
    }

    const parsedStreamBranch = parseStreamBranchName(branch);
    return Boolean(parsedStreamBranch && parsedStreamBranch.area === normalizedArea && branch === expectedStream);
  });
}

function filterRecentWorkpads(rows, area, streamBranch, limit = 3) {
  const seen = new Set();
  const workpads = [];

  for (const row of rows) {
    const key = `${row.title || ''}\0${row.created_at || ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const workpad = normalizeWorkpadRow(row);
    if (hasStreamWorkpadEvidence(workpad, area, streamBranch)) {
      workpads.push(workpad);
    }

    if (workpads.length >= limit) {
      break;
    }
  }

  return workpads;
}

module.exports = {
  filterRecentWorkpads,
  hasStreamWorkpadEvidence,
  normalizeWorkpadRow,
};