import { describe, expect, test } from 'bun:test';
import { READER_SHELL_VERSION, renderConsueloReader } from './render-consuelo-reader';
import { validateConsueloReaderHtml } from './validate-consuelo-reader';

const specContent = {
  template: 'spec' as const,
  title: 'Consuelo Test Spec',
  eyebrow: 'Spec · TDD fixture',
  thesis: 'A deterministic spec should render through the canonical Consuelo reader shell.',
  metadata: { status: 'Draft', owner: 'Ko', date: '2026-05-31', sourceTruth: 'TDD fixture' },
  map: [
    { label: 'Summary', href: '#summary' },
    { label: 'Requirements', href: '#requirements' },
    { label: 'Design', href: '#design' },
    { label: 'Task', href: '#ship-checklist' },
  ],
  sections: [
    { id: 'summary', eyebrow: 'Executive Summary', title: 'The decision', body: ['The renderer owns shell behavior; the template owns content logic.'] },
    { id: 'requirements', eyebrow: 'Requirements', title: 'What must be true', cards: [{ title: 'Shared shell', body: 'Every spec uses the same reader shell.' }, { title: 'Validation', body: 'Missing shell markers fail validation.' }] },
    { id: 'design', eyebrow: 'Design', title: 'One renderer, typed content', body: ['Specs, plans, and guides share chrome and deterministic section grammar.'] },
  ],
  ledgerTitle: 'Ship checklist',
  ledger: [{ title: 'Renderer', tag: 'required', items: [{ status: 'done' as const, text: 'Render shell markers.' }, { status: 'todo' as const, text: 'Run browser validation.' }] }],
};

const guideContent = {
  template: 'guide' as const,
  title: 'Prediction Before Reveal',
  eyebrow: 'Guide · TDD fixture',
  thesis: 'A guide should preserve teaching affordances inside the same hardcoded reader shell.',
  metadata: { status: 'Guide draft', owner: 'Ko', date: '2026-05-31', sourceTruth: 'TDD fixture' },
  sections: [
    { id: 'deep-idea', eyebrow: 'Deep Idea', title: 'The core insight', body: ['Teach the simple model first.'] },
    { id: 'eli5', eyebrow: 'Explain Like I’m 5', title: 'Tiny story', body: ['Use a simple metaphor before the mechanism.'] },
    { id: 'evidence', eyebrow: 'Evidence Trail', title: 'What the source supports', body: ['Keep evidence separate from interpretation.'] },
  ],
  components: [{ type: 'openQuestions' as const, title: 'Questions', questions: [{ title: 'Reason with it', body: 'What would you change if the lesson had no source?' }] }],
  ledgerTitle: 'Learning checklist',
  ledger: [{ title: 'Guide', tag: 'required', items: [{ status: 'current' as const, text: 'Use the canonical shell.' }] }],
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
    expect(html).toContain('data-reader-shell-version="');
    expect(html).toContain('https://consuelohq.com/favicon.svg');
    expect(html).toContain('name="theme-color" content="#202020"');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('/design-wiki');
    expect(html).toContain('Ship checklist');

    const result = validateConsueloReaderHtml(html);
    expect(result.ok).toBe(true);
  });

  test('renders guides through the same hardcoded reader shell', () => {
    const html = renderConsueloReader(guideContent);

    expect(html).toContain('Guide · TDD fixture');
    expect(html).toContain('Deep Idea');
    expect(html).toContain('Explain Like I’m 5');
    expect(html).toContain('Evidence Trail');
    expect(html).toContain('data-reader-component="openQuestions"');
    expect(html).toContain('template:"guide"');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
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
      map: [{ label: 'Summary', href: '#summary' }, { label: 'Requirements', href: '#requirements' }, { label: 'Validation', href: '#validation' }, { label: 'Task', href: '#ship-checklist' }],
      sections: [
        { id: 'summary', eyebrow: 'Why Now', title: 'Agents are tool-bound', callout: { label: 'Why now', title: 'Agents are tool-bound', body: 'A strong model without workspace state cannot complete valuable tasks.' }, metrics: [{ label: 'Surface', value: '4', body: 'Repo, browser, logs, approvals.' }, { label: 'Mode', value: 'Typed', body: 'Capabilities are explicit.' }], flow: [{ title: 'Task', body: 'User asks for work.' }, { title: 'Tool', body: 'Agent opens workspace.' }, { title: 'Proof', body: 'Artifact validates.' }] },
        { id: 'requirements', eyebrow: 'Requirements', title: 'What must be true', table: { columns: ['Area', 'Requirement', 'Validation'], rows: [['Positioning', 'Show the capability frontier.', 'Readable on iPhone.'], ['Benchmark', 'Use optional section components.', 'Renderer test passes.']] }, timeline: [{ title: 'Clone shell polish', tag: 'UI', body: 'Use roadmap shell styling.' }, { title: 'Add components', tag: 'Typed', body: 'Render charts, tables, timelines, and accordions.' }] },
        { id: 'validation', eyebrow: 'Validation Plan', title: 'Proof before scaling', details: [{ summary: 'Mobile table behavior', body: 'Tables collapse into labeled row cards instead of clipping.' }, { summary: 'Dark mode behavior', body: 'Dark overrides come after base styles.' }], ranges: [{ label: 'Shell parity', value: 90, max: 100, note: 'Roadmap parity target.' }, { label: 'Component coverage', value: 75, max: 100, note: 'More sections now typed.' }] },
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

describe('typed reader shell contract', () => {
  test('renders plan and guide as canonical reader shell kinds without introducing roadmap kind', () => {
    const planHtml = renderConsueloReader({
      template: 'plan',
      title: 'Consuelo Roadmap Fixture',
      eyebrow: 'Plan · Roadmap fixture',
      thesis: 'A roadmap is a plan rendered through the canonical reader shell.',
      metadata: { status: 'Fixture', owner: 'Ko', date: '2026-06-06', sourceTruth: 'Roadmap golden baseline' },
      sections: [{ id: 'summary', eyebrow: 'Summary', title: 'Roadmap is plan', body: ['No roadmap template exists.'] }],
      ledgerTitle: 'Roadmap checklist',
      ledger: [{ title: 'Shell', tag: 'required', items: [{ status: 'current', text: 'Render as plan.' }] }],
    });
    const guideHtml = renderConsueloReader(guideContent);

    expect(planHtml).toContain('data-reader-shell-version="');
    expect(planHtml).toContain('template:"plan"');
    expect(guideHtml).toContain('template:"guide"');
    expect(planHtml).not.toContain('template:"roadmap"');
    expect(validateConsueloReaderHtml(planHtml).ok).toBe(true);
    expect(validateConsueloReaderHtml(guideHtml).ok).toBe(true);
  });

  test('rejects uncategorized and roadmap as reader shell templates', () => {
    const base = { title: 'Rejected Fixture', thesis: 'This should not render.', sections: [{ id: 'summary', title: 'Summary', body: ['Body'] }], ledger: [{ title: 'Checklist', items: [{ status: 'todo' as const, text: 'No render.' }] }] };

    expect(() => renderConsueloReader({ ...base, template: 'uncategorized' as never })).toThrow('unsupported reader shell template');
    expect(() => renderConsueloReader({ ...base, template: 'roadmap' as never })).toThrow('unsupported reader shell template');
  });

  test('requires body sections and a checklist ledger for reader shell documents', () => {
    expect(() => renderConsueloReader({ template: 'spec', title: 'Missing checklist', thesis: 'Reader shell documents require a checklist.', sections: [{ id: 'summary', title: 'Summary', body: ['Body'] }] })).toThrow('reader shell document requires checklist ledger');
    expect(() => renderConsueloReader({ template: 'plan', title: 'Missing sections', thesis: 'Reader shell documents require sections.', ledger: [{ title: 'Checklist', items: [{ status: 'todo', text: 'No sections.' }] }] })).toThrow('reader shell document requires at least one body section');
  });

  test('renders optional typed components deterministically', () => {
    const html = renderConsueloReader({
      template: 'spec',
      title: 'Typed Components Fixture',
      eyebrow: 'Spec · Components',
      thesis: 'Agents choose optional modules, but the renderer owns their UI.',
      metadata: { status: 'Fixture', owner: 'Ko', date: '2026-06-06', sourceTruth: 'Component fixture' },
      sections: [{ id: 'summary', eyebrow: 'Summary', title: 'Typed modules', body: ['The shell renders all optional modules.'] }],
      components: [
        { type: 'timeline', title: 'Launch timeline', items: [{ title: 'Alpha', body: 'First pass.', tag: 'phase' }] },
        { type: 'decisionCards', title: 'Decisions', items: [{ summary: 'Use the TS renderer', body: 'Markdown steering is not deterministic.', open: true }] },
        { type: 'requirementsMatrix', title: 'Requirements', columns: ['Area', 'Requirement'], rows: [['Shell', 'Use typed input.']] },
        { type: 'architectureFlow', title: 'Architecture', nodes: [{ title: 'Input' }, { title: 'Renderer' }, { title: 'HTML' }] },
        { type: 'riskPanels', title: 'Risks', risks: [{ title: 'Freehand UI', body: 'Agents drift without typed rendering.', tag: 'blocked' }] },
        { type: 'metricCards', title: 'Signals', cards: [{ label: 'Parity', value: '100%', body: 'Roadmap baseline.' }] },
        { type: 'openQuestions', title: 'Open questions', questions: [{ title: 'Which guides migrate first?', body: 'Pick after shell lands.' }] },
      ],
      ledgerTitle: 'Typed checklist',
      ledger: [{ title: 'Renderer', tag: 'required', items: [{ status: 'current', text: 'Render optional modules through code.' }] }],
    });

    expect(html).toContain('data-reader-component="timeline"');
    expect(html).toContain('data-reader-component="decisionCards"');
    expect(html).toContain('data-reader-component="requirementsMatrix"');
    expect(html).toContain('data-reader-component="architectureFlow"');
    expect(html).toContain('data-reader-component="riskPanels"');
    expect(html).toContain('data-reader-component="metricCards"');
    expect(html).toContain('data-reader-component="openQuestions"');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});

describe('direct rich reader component names', () => {
  test('renders PR 666 component names as first-class typed options', () => {
    const html = renderConsueloReader({
      template: 'spec',
      title: 'Direct Components Fixture',
      eyebrow: 'Spec · Direct Components',
      thesis: 'The framework keeps the useful PR 666 component vocabulary while the renderer owns the UI.',
      metadata: { status: 'Fixture', owner: 'Ko', date: '2026-06-06', sourceTruth: 'PR 666 component audit' },
      sections: [{ id: 'summary', title: 'Typed shell', body: ['Direct components render through code, not custom HTML.'] }],
      components: [
        { type: 'callout', title: 'Callout module', callout: { label: 'Signal', title: 'Use this for the big point.', body: 'The component is typed and renderer-owned.' } },
        { type: 'metrics', title: 'Metric module', metrics: [{ label: 'Coverage', value: '10', body: 'Direct components restored.' }] },
        { type: 'flow', title: 'Flow module', nodes: [{ title: 'Input' }, { title: 'Renderer' }, { title: 'Output' }] },
        { type: 'table', title: 'Table module', table: { columns: ['Area', 'Requirement'], rows: [['Reader', 'Mobile-safe cells']] } },
        { type: 'timeline', title: 'Timeline module', items: [{ title: 'Restore', body: 'Keep useful direction.' }] },
        { type: 'details', title: 'Details module', details: [{ summary: 'Why typed?', body: 'So agents cannot freehand the shell.' }] },
        { type: 'ranges', title: 'Ranges module', ranges: [{ label: 'Delight', value: 88, max: 100, note: 'A scoring bar.' }] },
        { type: 'comparisons', title: 'Comparison module', comparisons: [{ title: 'Bad copy', body: 'Do not import weak styling.', tag: 'avoid' }, { title: 'Typed direction', body: 'Keep only the contract.', tag: 'keep' }] },
        { type: 'cards', title: 'Cards module', cards: [{ title: 'Card', body: 'Cards remain first-class.' }] },
        { type: 'ledger', title: 'Ledger module', groups: [{ title: 'Checklist', items: [{ status: 'done', text: 'Render direct ledger.' }] }] },
      ],
      ledgerTitle: 'Required checklist',
      ledger: [{ title: 'Renderer', items: [{ status: 'current', text: 'Validate the shell.' }] }],
    });

    for (const name of ['callout', 'metrics', 'flow', 'table', 'timeline', 'details', 'ranges', 'comparisons', 'cards', 'ledger']) {
      expect(html).toContain(`data-reader-component="${name}"`);
    }
    expect(html).toContain('data-label="Requirement"');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});
describe('roadmap mobile parity shell polish', () => {
  test('uses roadmap-style nav, thesis, resume, and progress affordances', () => {
    const html = renderConsueloReader({
      template: 'guide',
      title: 'How To Speak - Communication Field Guide',
      eyebrow: 'communication guide - 2026-06-07',
      thesis: 'A good talk is an attention system: promise the listener a useful capability, give them landmarks, and package the idea so they can carry it away.',
      metadata: { status: 'reworked guide', owner: 'Ko / Consuelo', date: '2026-06-07', sourceTruth: 'TDD fixture' },
      sections: [
        { id: 'decision', eyebrow: 'the decision', title: 'Treat every talk as attention design.', body: ['A talk is a path with handles.'], cards: [{ title: 'Promise', body: 'Start with the listener capability.' }] },
        { id: 'slides', eyebrow: 'slides', title: 'Slides reduce load.', callout: { label: 'thesis', title: 'Make the slide title the takeaway.', body: 'The visual supports one point.' } },
      ],
      components: [{ type: 'table', title: 'Talk design checklist', table: { columns: ['Check', 'Question'], rows: [['Promise', 'What can they do?']] } }],
      ledgerTitle: 'Memory review',
      ledger: [{ title: 'Learning checklist', items: [{ status: 'current', text: 'Apply this to one talk.' }] }],
    });

    expect(html).toContain('class="hero-thesis"');
    expect(html).toContain('class="reader-nav-task"');
    expect(html).toContain('Task</a>');
    expect(html).toContain('class="reader-back-to-top-progress"');
    expect(html).toContain('data-auto-dismiss-ms="10000"');
    expect(html).not.toContain('class="reader-progress"');
    expect(html).not.toContain('data-dismiss-resume');
    expect(html).toContain('smoother.scrollTo(target, true,');
    expect(html).toContain('window.__readerShell = { shell:');
    expect(html).toContain('font-size:clamp(48px, 12vw, 88px)');
    expect(html).toContain('--serif: Georgia, ui-serif');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });

  test('card-only sections avoid double-framed nesting', () => {
    const html = renderConsueloReader({
      template: 'plan',
      title: 'Roadmap Card Fixture',
      eyebrow: 'plan fixture',
      thesis: 'Card sections should feel like roadmap cards instead of frames inside frames.',
      sections: [{ id: 'scope', eyebrow: 'goals and non-goals', title: 'Scope control', cards: [{ title: 'Goals', body: 'Make decision infrastructure the category spine.' }, { title: 'Non-goals', body: 'Keep the page focused.' }] }],
      ledgerTitle: 'Task',
      ledger: [{ title: 'Checklist', items: [{ status: 'done', text: 'Render card-only section.' }] }],
    });

    expect(html).toContain('section-content flat-content');
    expect(html).toContain('grid-2 roadmap-card-grid');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});

describe('reader nav allocation and tap-scroll refinement', () => {
  test('gives the title maximum nav space and groups links beside task', () => {
    const html = renderConsueloReader({
      template: 'guide',
      title: 'How To Speak - Communication Field Guide',
      eyebrow: 'communication guide',
      thesis: 'A good talk is an attention system.',
      sections: [{ id: 'deep-idea', eyebrow: 'Deep idea', title: 'Speaking is attention design', body: ['Promise, map, mechanism, evidence, package.'] }],
      ledgerTitle: 'Task',
      ledger: [{ title: 'Checklist', items: [{ status: 'current', text: 'Review nav spacing.' }] }],
      map: [{ label: 'Deep idea', href: '#deep-idea' }, { label: 'Source', href: '#source' }, { label: 'ELI5', href: '#eli5' }, { label: 'Task', href: '#ship-checklist' }],
    });

    expect(html).toContain('grid-template-columns:minmax(0,1fr) auto auto');
    expect(html).toContain('.reader-links { display:flex; justify-content:flex-end; justify-self:end;');
    expect(html).not.toContain('grid-template-columns:minmax(120px,auto) minmax(0,1fr) auto');
    expect(html).toContain('class="reader-nav-task"');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });

  test('renders roadmap-style left and right tap zones for page stepping', () => {
    const html = renderConsueloReader({
      template: 'guide',
      title: 'Tap Zone Fixture',
      thesis: 'Clicking the right side should step down; clicking the left side should step up.',
      sections: [{ id: 'one', title: 'One', body: ['First.'] }, { id: 'two', title: 'Two', body: ['Second.'] }],
      ledgerTitle: 'Task',
      ledger: [{ title: 'Checklist', items: [{ status: 'todo', text: 'Tap through sections.' }] }],
    });

    expect(html).toContain('class="reader-tap-zone reader-tap-zone-left"');
    expect(html).toContain('class="reader-tap-zone reader-tap-zone-right"');
    expect(html).toContain('data-tap-scroll="up"');
    expect(html).toContain('data-tap-scroll="down"');
    expect(html).toContain('function pageStep(direction)');
    expect(html).toContain('innerHeight * 0.62');
    expect(html).toContain('document.querySelectorAll(\'[data-tap-scroll]\')');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});

describe('reader nesting flattening refinement', () => {
  test('flattens single-component body sections that previously nested table and flow cards', () => {
    const html = renderConsueloReader({
      template: 'guide',
      title: 'Flattening Fixture',
      thesis: 'Single content modules should not sit inside an extra framed section wrapper.',
      sections: [
        { id: 'vocabulary', eyebrow: 'Vocabulary', title: 'Paper vocabulary translated into operator moves', table: { columns: ['Term', 'Meaning', 'How Ko uses it'], rows: [['Empowerment promise', 'A clear statement.', 'Open with capability.']] } },
        { id: 'mechanism', eyebrow: 'Mechanism', title: 'The talk mechanism', flow: [{ title: 'Promise', body: 'Tell them what they can do.' }, { title: 'Map', body: 'Give landmarks.' }] },
        { id: 'rule', eyebrow: 'Field rule', title: 'Before a talk, write five sentences.', callout: { label: 'Operator rule', title: 'Before a talk, write five sentences.', body: 'By the end you will be able to __.' } },
        { id: 'cards', eyebrow: 'Cards', title: 'Scope control', cards: [{ title: 'Goals', body: 'Keep the card direct.' }] },
      ],
      ledgerTitle: 'Task',
      ledger: [{ title: 'Checklist', items: [{ status: 'done', text: 'Flatten all single components.' }] }],
    });

    expect(html.match(/section-content flat-content/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('<div class="section-content flat-content"><div class="matrix">');
    expect(html).toContain('<div class="section-content flat-content"><div class="diagram">');
    expect(html).toContain('<div class="section-content flat-content"><div class="callout">');
    expect(html).toContain('<div class="section-content flat-content"><div class="grid-2 roadmap-card-grid">');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });

  test('flattens typed table and flow components too', () => {
    const html = renderConsueloReader({
      template: 'guide',
      title: 'Typed Flattening Fixture',
      thesis: 'Typed components should inherit the same flattened frame behavior.',
      sections: [{ id: 'intro', title: 'Intro', body: ['Intro.'] }],
      components: [
        { type: 'table', title: 'Talk design checklist', table: { columns: ['Check', 'Question'], rows: [['Promise', 'What can they do?']] } },
        { type: 'flow', title: 'Practice route', nodes: [{ title: 'Draft' }, { title: 'Practice' }] },
      ],
      ledgerTitle: 'Task',
      ledger: [{ title: 'Checklist', items: [{ status: 'current', text: 'Flatten typed components.' }] }],
    });

    expect(html).toContain('data-reader-component="table"><div class="container"><p class="eyebrow">Table</p><h2>Talk design checklist</h2><div class="section-content flat-content"><div class="matrix">');
    expect(html).toContain('data-reader-component="flow"><div class="container"><p class="eyebrow">Flow</p><h2>Practice route</h2><div class="section-content flat-content"><div class="diagram">');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});

describe('reader nav display title', () => {
  test('uses the short artifact title in the nav while preserving the full label', () => {
    const html = renderConsueloReader({
      template: 'guide',
      title: 'How To Speak - Communication Field Guide',
      thesis: 'The nav should show the readable short title, not clip it to How To Spe.',
      sections: [{ id: 'summary', title: 'Summary', body: ['Body.'] }],
      ledgerTitle: 'Task',
      ledger: [{ title: 'Checklist', items: [{ status: 'todo', text: 'Check title.' }] }],
    });

    expect(html).toContain('class="reader-brand" href="/design-wiki" aria-label="How To Speak - Communication Field Guide" title="How To Speak - Communication Field Guide">How To Speak</a>');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});

describe('reader shell version contract', () => {
  test('advertises the current canonical shell version in html and footer', () => {
    const html = renderConsueloReader({
      template: 'guide',
      title: 'Version Fixture',
      thesis: 'The shell version is part of the artifact contract for downstream agents.',
      sections: [{ id: 'summary', title: 'Summary', body: ['Version markers must stay explicit.'] }],
      ledgerTitle: 'Task',
      ledger: [{ title: 'Checklist', items: [{ status: 'current', text: 'Check shell version.' }] }],
    });

    expect(READER_SHELL_VERSION).toBe('1.3.0');
    expect(html).toContain('data-reader-shell-version="1.3.0"');
    expect(html).toContain('version:"1.3.0"');
    expect(html).toContain('canonical Consuelo reader shell 1.3.0');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});

describe('reader mixed module flattening', () => {
  test('flattens no-body sections even when they contain multiple modules', () => {
    const html = renderConsueloReader({
      template: 'guide',
      title: 'Mixed Flat Fixture',
      thesis: 'A callout plus flow should not create a third enclosing frame.',
      sections: [{
        id: 'mechanism',
        eyebrow: 'Mechanism',
        title: 'The talk mechanism',
        callout: { label: 'Operator rule', title: 'Before a talk, write five sentences.', body: 'Prep the route first.' },
        flow: [{ title: 'Promise', body: 'Capability first.' }, { title: 'Map', body: 'Landmarks second.' }],
      }],
      ledgerTitle: 'Task',
      ledger: [{ title: 'Checklist', items: [{ status: 'current', text: 'Flatten mixed modules.' }] }],
    });

    expect(html).toContain('<div class="section-content flat-content"><div class="callout">');
    expect(html).toContain('</div><div class="diagram"><div class="flow-row">');
    expect(validateConsueloReaderHtml(html).ok).toBe(true);
  });
});
