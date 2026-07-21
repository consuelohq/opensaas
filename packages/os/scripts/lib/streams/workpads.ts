import type { StreamWorkpad, WorkpadRow } from './types';

function normalizeArea(area: string): string {
  return area.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeWorkpadRow(row: WorkpadRow): StreamWorkpad {
  return {
    title: row.title,
    category: row.category,
    date: row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '',
    content: row.content || '',
  };
}

export function hasStreamWorkpadEvidence(workpad: WorkpadRow, area: string, streamBranch?: string): boolean {
  const normalizedArea = normalizeArea(area);
  const expectedStream = streamBranch || `stream/${normalizedArea}`;
  const content = `${workpad.title || ''}\n${workpad.content || ''}`;
  const branchMatches = content.match(/\b(?:task|stream)\/[a-z0-9-]+(?:\/[a-z0-9._-]+)?/g) || [];

  return branchMatches.some((branch) => {
    const taskMatch = /^task\/([a-z0-9-]+)\/[a-z0-9._-]+$/.exec(branch);
    if (taskMatch) return taskMatch[1] === normalizedArea;
    const streamMatch = /^stream\/([a-z0-9-]+)$/.exec(branch);
    return Boolean(streamMatch && streamMatch[1] === normalizedArea && branch === expectedStream);
  });
}

export function filterRecentWorkpads(
  rows: WorkpadRow[],
  area: string,
  streamBranch?: string,
  limit = 3,
): StreamWorkpad[] {
  const seen = new Set<string>();
  const workpads: StreamWorkpad[] = [];
  for (const row of rows) {
    const key = `${row.title || ''}\0${row.created_at || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (hasStreamWorkpadEvidence(row, area, streamBranch)) workpads.push(normalizeWorkpadRow(row));
    if (workpads.length >= limit) break;
  }
  return workpads;
}
