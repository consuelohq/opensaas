import { describe, expect, it } from 'vitest';
import { renderConsueloReader, type ConsueloReaderContent } from '../scripts/artifact-render';

function baseContent(overrides: Partial<ConsueloReaderContent> = {}): ConsueloReaderContent {
  return {
    template: 'spec',
    title: 'Reader Map Safety',
    thesis: 'Reader map hrefs are normalized before rendering.',
    sections: [
      { id: 'overview', title: 'Overview', body: ['Safe section.'] },
    ],
    ledger: [
      { title: 'Ship', items: [{ status: 'todo', text: 'Validate rendered links.' }] },
    ],
    ...overrides,
  };
}

describe('artifact reader renderer', () => {
  it('normalizes map hrefs before rendering anchors and rail selectors', () => {
    const html = renderConsueloReader(baseContent({
      map: [
        { label: 'Script', href: 'javascript:alert(1)' },
        { label: 'Plain', href: 'plain target' },
        { label: 'Empty', href: '' },
      ],
    }));

    expect(html).not.toContain('javascript:alert');
    expect(html).toContain('href="#javascript-alert-1"');
    expect(html).toContain('data-target="#javascript-alert-1"');
    expect(html).toContain('href="#plain-target"');
    expect(html).toContain('data-target="#section-empty"');
  });
});
