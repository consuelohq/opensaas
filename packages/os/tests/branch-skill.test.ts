import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('OS Branch skill', () => {
  it('proactively models large work as a dependency graph with stable short IDs', () => {
    const body = read('packages/os/skills/branch/SKILL.md');

    expect(body).toContain('D0');
    expect(body).toContain('M0A');
    expect(body).toMatch(/proactiv/i);
    expect(body).toMatch(/dependency graph/i);
    expect(body).toMatch(/stable short ID/i);
    expect(body).toMatch(/context management/i);
    expect(body).toMatch(/working memory/i);
    expect(body).toMatch(/1.?3 letters/i);
    expect(body).toMatch(/Branch in new chat/i);
  });

  it('requires a finalization join node for holistic review, cleanup, and promotion', () => {
    const body = read('packages/os/skills/branch/SKILL.md');

    expect(body).toMatch(/finalization/i);
    expect(body).toMatch(/task PR/i);
    expect(body).toMatch(/failing check/i);
    expect(body).toMatch(/CodeRabbit/i);
    expect(body).toMatch(/Codex/i);
    expect(body).toMatch(/subagent/i);
    expect(body).toMatch(/fresh|zero-context/i);
    expect(body).toMatch(/worktree/i);
    expect(body).toMatch(/canary/i);
    expect(body).toMatch(/Consuelo update|consuelo update/i);
    expect(body).toMatch(/sync local main/i);
  });

  it('advertises graph fan-out and approved short-ID execution in metadata', () => {
    const metadata = JSON.parse(read('packages/os/skills/branch/skill.json')) as {
      description: string;
      trigger: string;
    };

    expect(metadata.description).toMatch(/dependency graph/i);
    expect(metadata.description).toMatch(/parallel/i);
    expect(metadata.description).toMatch(/context|memory/i);
    expect(metadata.trigger).toMatch(/phase|epic|migration/i);
    expect(metadata.trigger).toMatch(/branched chat/i);
    expect(metadata.trigger).toContain('D0');
  });
});
