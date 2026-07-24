import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

function pathFilters(): string[] {
  const source = readFileSync(resolve(repositoryRoot, '.coderabbit.yaml'), 'utf8');
  const block = source.match(/path_filters:\s*\n((?:\s+-\s+[^\n]+\n?)*)/u)?.[1] ?? '';
  return [...block.matchAll(/^\s+-\s+["']?([^"'\n]+)["']?\s*$/gmu)].map((match) => match[1]);
}

describe('CodeRabbit review scope', () => {
  it('explicitly includes repository source while excluding task metadata except workpads', () => {
    const filters = pathFilters();

    expect(filters[0]).toBe('**');
    expect(filters).toContain('!.task/**');
    expect(filters).toContain('.task/**/workpad.md');
    expect(filters.indexOf('**')).toBeLessThan(filters.indexOf('!.task/**'));
    expect(filters.indexOf('!.task/**')).toBeLessThan(filters.indexOf('.task/**/workpad.md'));
  });
});
