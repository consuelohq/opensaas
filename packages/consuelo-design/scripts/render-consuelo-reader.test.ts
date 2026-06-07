import { describe, expect, test } from 'bun:test';
import { renderConsueloReader } from './render-consuelo-reader';
import { validateConsueloReaderHtml } from './validate-consuelo-reader';

const specContent = {
  template: 'spec' as const,
  title: 'Consuelo Test Spec',
  eyebrow: 'Spec · TDD fixture',
  thesis: 'A deterministic spec should render through the canonical Consuelo reader shell.',
  metadata: {
    status: 'Draft',
    owner: 'Ko',
    date: '2026-05-31',
    sourceTruth: 'TDD fixture',
  },
  map: [
    { label: 'Summary', href: '#summary' },
    { label: 'Requirements', href: '#requirements' },
    { label: 'Design', href: '#design' },
    { label: 'Task', href: '#ship-checklist' },
  ],
  sections: [
    {
      id: 'summary',
      eyebrow: 'Executive Summary',
      title: 'The decision',
      body: ['The renderer owns shell behavior; the template owns content logic.'],
    },
    {
      id: 'requirements',
      eyebrow: 'Requirements',
      title: 'What must be true',
      cards: [
        { title: 'Shared shell', body: 'Every spec uses the same reader shell.' },
        { title: 'Validation', body: 'Missing shell markers fail validation.' },
      ],
    },
    {
      id: 'design',
      eyebrow: 'Design',
      title: 'One renderer, two content contracts',
      body: ['Specs and research lessons share chrome but keep different section grammar.'],
    },
  ],
  ledgerTitle: 'Ship checklist',
  ledger: [
    {
      title: 'Renderer',
      tag: 'required',
      items: [
        { status: 'done' as const, text: 'Render shell markers.' },
        { status: 'todo' as const, text: 'Run browser validation.' },
      ],
    },
  ],
};

const researchContent = {
  template: 'research' as const,
  title: 'Prediction Before Reveal',
  eyebrow: 'Lesson · TDD fixture',
  thesis: 'A lesson should preserve teaching affordances inside the same reader shell.',
  metadata: {
    status: 'Lesson draft',
    owner: 'Ko',
    date: '2026-05-31',
    sourceTruth: 'TDD fixture',
  },
  sourceCard: {
    title: 'A Small Teaching Source',
    authors: 'Consuelo',
    year: '2026',
    status: 'fixture',
  },
  learningRoute: ['Puzzle', 'Simple model', 'Prediction', 'Evidence', 'Memory'],
  sections: [
    { id: 'deep-idea', eyebrow: 'Deep Idea', title: 'The core insight', body: ['Teach the simple model first.'] },
    { id: 'eli5', eyebrow: 'Explain Like I’m 5', title: 'Tiny story', body: ['Use a simple metaphor before the mechanism.'] },
    { id: 'prediction', eyebrow: 'Prediction Before Reveal', title: 'Make a guess', body: ['Ask Ko what he expects before revealing the answer.'] },
    { id: 'vocabulary', eyebrow: 'Vocabulary', title: 'Words to know', cards: [{ title: 'Renderer', body: 'The repeatable page builder.' }] },
    { id: 'evidence', eyebrow: 'Evidence Trail', title: 'What the source supports', body: ['Keep evidence separate from interpretation.'] },
    { id: 'memory', eyebrow: 'Memory Card', title: 'Save this', body: ['Shell is fixed; teaching structure varies.'] },
    { id: 'question', eyebrow: 'Question for Ko', title: 'Reason with it', body: ['What would you change if the lesson had no source?'] },
  ],
};

describe('renderConsueloReader', () => {
  test('renders specs through the canonical reader shell', () => {
    const html = renderConsueloReader(specContent);

    expect(html).toContain('id="smooth-wrapper"');
    expect(html).toContain('id="smooth-content"');
    expect(html).toContain('window.__readerShell');
    expect(html).toContain('class="reader-nav-shell"');
    expect(html).toContain('class="reader-section-rail"');
    expect(html).toContain('class="reader-resume"');
    expect(html).toContain('class="reader-back-to-top"');
    expect(html).toContain('https://consuelohq.com/favicon.svg');
    expect(html).toContain('name="theme-color" content="#202020"');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('/design-wiki');
    expect(html).toContain('Ship checklist');

    const result = validateConsueloReaderHtml(html);
    expect(result.ok).toBe(true);
  });

  test('renders research lessons with teaching-specific sections in the canonical shell', () => {
    const html = renderConsueloReader(researchContent);

    expect(html).toContain('Source Card');
    expect(html).toContain('Learning Route');
    expect(html).toContain('Explain Like I’m 5');
    expect(html).toContain('Prediction Before Reveal');
    expect(html).toContain('Vocabulary');
    expect(html).toContain('Evidence Trail');
    expect(html).toContain('Memory Card');
    expect(html).toContain('Question for Ko');

    const result = validateConsueloReaderHtml(html);
    expect(result.ok).toBe(true);
  });

  test('validator rejects shell-less html', () => {
    const result = validateConsueloReaderHtml('<main><h1>Shell-less</h1></main>');

    expect(result.ok).toBe(false);
    expect(result.missing).toContain('#smooth-wrapper');
    expect(result.missing).toContain('window.__readerShell');
  });

  test('renders rich optional section components with mobile-safe tables and shell polish', () => {
    const html = renderConsueloReader({
      template: 'spec',
      title: 'Benchmark Entry Fixture',
      eyebrow: 'Spec · Benchmark',
      thesis: 'The benchmark page should use the same polished reader shell as the roadmap.',
      metadata: { status: 'Fixture', owner: 'Ko', date: '2026-05-31', sourceTruth: 'Screenshot regression' },
      map: [
        { label: 'Summary', href: '#summary' },
        { label: 'Requirements', href: '#requirements' },
        { label: 'Validation', href: '#validation' },
        { label: 'Task', href: '#ship-checklist' },
      ],
      sections: [
        {
          id: 'summary',
          eyebrow: 'Why Now',
          title: 'Agents are tool-bound',
          callout: { label: 'Why now', title: 'Agents are tool-bound', body: 'A strong model without workspace state cannot complete valuable tasks.' },
          metrics: [
            { label: 'Surface', value: '4', body: 'Repo, browser, logs, approvals.' },
            { label: 'Mode', value: 'Typed', body: 'Capabilities are explicit.' },
          ],
          flow: [
            { title: 'Task', body: 'User asks for work.' },
            { title: 'Tool', body: 'Agent opens workspace.' },
            { title: 'Proof', body: 'Artifact validates.' },
          ],
        },
        {
          id: 'requirements',
          eyebrow: 'Requirements',
          title: 'What must be true',
          table: {
            columns: ['Area', 'Requirement', 'Validation'],
            rows: [
              ['Positioning', 'Show the capability frontier.', 'Readable on iPhone.'],
              ['Benchmark', 'Use optional section components.', 'Renderer test passes.'],
            ],
          },
          timeline: [
            { title: 'Clone shell polish', tag: 'UI', body: 'Use roadmap shell styling.' },
            { title: 'Add components', tag: 'Typed', body: 'Render charts, tables, timelines, and accordions.' },
          ],
        },
        {
          id: 'validation',
          eyebrow: 'Validation Plan',
          title: 'Proof before scaling',
          details: [
            { summary: 'Mobile table behavior', body: 'Tables collapse into labeled row cards instead of clipping.' },
            { summary: 'Dark mode behavior', body: 'Dark overrides come after base styles.' },
          ],
          ranges: [
            { label: 'Shell parity', value: 90, max: 100, note: 'Roadmap parity target.' },
            { label: 'Component coverage', value: 75, max: 100, note: 'More sections now typed.' },
          ],
        },
      ],
      ledgerTitle: 'Ship checklist',
      ledger: [{ title: 'Renderer', tag: 'TDD', items: [{ status: 'current', text: 'Keep shell polish deterministic.' }] }],
    });

    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('class="callout"');
    expect(html).toContain('class="metric-grid"');
    expect(html).toContain('class="diagram"');
    expect(html).toContain('class="timeline"');
    expect(html).toContain('class="decision-grid"');
    expect(html).toContain('class="range-grid"');
    expect(html).toContain('data-label="Requirement"');
    expect(html).toContain('@media (hover:hover)');
    expect(html).toContain('@media (max-width: 680px)');
    expect(html.lastIndexOf('@media (prefers-color-scheme: dark)')).toBeGreaterThan(0);

    const darkIndex = html.lastIndexOf('@media (prefers-color-scheme: dark)');
    const baseNavIndex = html.indexOf('.reader-nav-shell {');
    expect(darkIndex).toBeGreaterThan(baseNavIndex);
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});
