import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { filterRecentWorkpads, hasStreamWorkpadEvidence } = require('../scripts/lib/stream-workpads.js');

describe('stream workpad scoping', () => {
  it('excludes cross-stream workpads whose titles contain the area as a substring', () => {
    const rows = [
      {
        title: 'workpad: task/design/update-consuelo-roadmap-mvs-positioning',
        category: 'workpad',
        created_at: '2026-06-01T15:36:00.000Z',
        content: '# Update Consuelo roadmap MVS positioning\n\nstream: `stream/design`',
      },
      {
        title: 'workpad: task/os/sync-os-dev-tooling-substrate',
        category: 'workpad',
        created_at: '2026-05-31T11:37:00.000Z',
        content: '# sync os dev tooling substrate\n\nstream: `stream/os`',
      },
    ];

    expect(filterRecentWorkpads(rows, 'os', 'stream/os', 3).map((workpad) => workpad.title)).toEqual([
      'workpad: task/os/sync-os-dev-tooling-substrate',
    ]);
  });

  it('accepts workpads with stream evidence in content when the title is generic', () => {
    const row = {
      title: 'workpad: current task',
      category: 'workpad',
      created_at: '2026-06-01T10:00:00.000Z',
      content: '# current task\n\nstream: `stream/workspace-agents`',
    };

    expect(hasStreamWorkpadEvidence(row, 'workspace-agents', 'stream/workspace-agents')).toBe(true);
    expect(filterRecentWorkpads([row], 'workspace-agents', 'stream/workspace-agents', 3)).toHaveLength(1);
  });

  it('rejects generic title/content mentions without a task or stream branch token', () => {
    const row = {
      title: 'workpad: positioning notes for os copy',
      category: 'workpad',
      created_at: '2026-06-01T10:00:00.000Z',
      content: 'notes mention os but no task or stream branch',
    };

    expect(hasStreamWorkpadEvidence(row, 'os', 'stream/os')).toBe(false);
    expect(filterRecentWorkpads([row], 'os', 'stream/os', 3)).toEqual([]);
  });
});