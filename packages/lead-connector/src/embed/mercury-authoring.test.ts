import { expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';
import {
  createMercuryAuthoringApi,
  parseMercuryPreview,
  renderMercuryPublication,
} from './mercury-authoring';
import type { CoachingScript } from './coaching-scripts';
const script: CoachingScript = {
  id: 'script',
  title: 'Life insurance',
  content:
    '# Family\n- Ask about family\n- Review current coverage\n- Agree on next steps',
  revision: 2,
  updatedAt: '',
  canEdit: true,
  canPublish: true,
};
const compiled = {
  playbook: {
    cards: [
      {
        id: 'family',
        title: 'Family',
        slots: [
          'Ask about family',
          'Review current coverage',
          'Agree on next steps',
        ].map((text, i) => ({
          id: String(i),
          text,
          source: { documentId: 'script', revision: '2', excerpt: text },
        })),
      },
    ],
  },
  spans: { family: { start: 0, end: 100 } },
};
it('requires an actual publication capability and a fresh explicit approval for the exact preview', () => {
  const preview = parseMercuryPreview({ preview: compiled });
  const state = {
    scriptId: 'script',
    savedRevision: 2,
    expectedPublishedVersion: 0,
    requestKey: 1,
    preview,
    pending: false,
  };
  const unavailable = new JSDOM(
    renderMercuryPublication({ ...script, canPublish: false }, state),
  ).window.document;
  expect(
    unavailable.querySelector('[data-action="script-preview"]'),
  ).toBeNull();
  const doc = new JSDOM(renderMercuryPublication(script, state)).window
    .document;
  expect(doc.body.textContent).toContain('Ask about family');
  expect(
    doc.querySelector<HTMLInputElement>('[name="approved"]')?.required,
  ).toBe(true);
  expect(
    doc.querySelector<HTMLInputElement>('[name="approved"]')?.checked,
  ).toBe(false);
  expect(Boolean(doc.querySelector('[name="industryPackVersion"]'))).toBe(
    false,
  );
  expect(Boolean(doc.querySelector('[name="companyPolicyVersion"]'))).toBe(
    false,
  );
  const next = new JSDOM(
    renderMercuryPublication(script, { ...state, requestKey: 2 }),
  ).window.document;
  expect(doc.querySelector('form')?.dataset.form).not.toBe(
    next.querySelector('form')?.dataset.form,
  );
});
it('sends explicit approval and revision fences through authenticated authoring routes', async () => {
  const requests: Request[] = [];
  const api = createMercuryAuthoringApi({
    baseUrl: 'https://example.test',
    getToken: () => 'fixture',
    fetch: async (input, init) => {
      const r = new Request(input, init);
      requests.push(r);
      return new Response(
        JSON.stringify(
          r.url.endsWith('/versions')
            ? { versions: [] }
            : r.url.endsWith('/preview')
              ? { preview: compiled }
              : {
                  version: 1,
                  sourceRevision: 2,
                  createdAt: '2026-11-13T00:00:00Z',
                  compiled,
                },
        ),
      );
    },
  });
  await api.versions('script');
  await api.preview('script', 2);
  await api.publish('script', {
    expectedRevision: 2,
    expectedPublishedVersion: 0,
    approved: true,
  });
  expect(
    requests.every((r) => r.headers.get('authorization') === 'Bearer fixture'),
  ).toBe(true);
  expect(await requests[1]!.json()).toEqual({ expectedRevision: 2 });
  expect(await requests[2]!.json()).toEqual({
    expectedRevision: 2,
    expectedPublishedVersion: 0,
    approved: true,
  });
});
it('rejects non-glanceable or unproven preview cards before approval', () => {
  expect(() =>
    parseMercuryPreview({
      preview: { playbook: { cards: [{ id: 'x', title: 'X', slots: [] }] } },
    }),
  ).toThrow();
  expect(() =>
    parseMercuryPreview({
      preview: {
        playbook: {
          cards: [
            {
              ...compiled.playbook.cards[0],
              slots: compiled.playbook.cards[0]!.slots.map((s) => ({
                ...s,
                source: { ...s.source, excerpt: '' },
              })),
            },
          ],
        },
      },
    }),
  ).toThrow();
  const unsafe = parseMercuryPreview({
    preview: {
      ...compiled,
      playbook: {
        cards: [
          { ...compiled.playbook.cards[0], title: '<script>unsafe</script>' },
        ],
      },
    },
  });
  expect(
    renderMercuryPublication(script, {
      scriptId: 'script',
      savedRevision: 2,
      expectedPublishedVersion: 0,
      requestKey: 3,
      preview: unsafe,
      pending: false,
    }),
  ).toContain('&lt;script&gt;');
});

it('never restores a previous approval checkbox onto a newly reviewed preview', async () => {
  const { replaceWorkspace } = await import('./workspace-dom');
  const root = new JSDOM(
    '<div id="app"></div>',
  ).window.document.querySelector<HTMLElement>('#app')!;
  const state = {
    scriptId: 'script',
    savedRevision: 2,
    expectedPublishedVersion: 0,
    requestKey: 10,
    preview: parseMercuryPreview({ preview: compiled }),
    pending: false,
  };
  replaceWorkspace(root, renderMercuryPublication(script, state));
  root.querySelector<HTMLInputElement>('[name="approved"]')!.checked = true;
  replaceWorkspace(
    root,
    renderMercuryPublication(script, { ...state, pending: true }),
  );
  expect(
    root.querySelector<HTMLInputElement>('[name="approved"]')?.checked,
  ).toBe(true);
  replaceWorkspace(
    root,
    renderMercuryPublication(script, { ...state, requestKey: 11 }),
  );
  expect(
    root.querySelector<HTMLInputElement>('[name="approved"]')?.checked,
  ).toBe(false);
});

it('puts the publish preview entry before a long saved script without changing the editor', async () => {
  const { renderWorkspacePage } = await import('./workspace-pages');
  const { createInitialEmbedState } = await import('./state-machine');
  const html = renderWorkspacePage(createInitialEmbedState(), {
    screen: 'mercury',
    mode: 'outbound',
    compact: false,
    scriptId: script.id,
    coachingLibrary: { scripts: [script] },
  });
  expect(html.indexOf('Preview talking points')).toBeLessThan(
    html.indexOf('class="script-reader"'),
  );
  expect(html).toContain('data-action="script-edit"');
});

it('shows the exact source-derived listening phrases before approval and distinguishes manual-only cards', () => {
  const preview = parseMercuryPreview({
    preview: {
      ...compiled,
      rules: [
        {
          cardId: 'family',
          aliases: ['family priorities'],
          required: [],
          forbidden: [],
          priority: 0,
          speaker: 'customer',
          nextCardIds: [],
        },
      ],
    },
  });
  const html = renderMercuryPublication(script, {
    scriptId: 'script',
    savedRevision: 2,
    expectedPublishedVersion: 0,
    requestKey: 20,
    preview,
    pending: false,
  });
  expect(html).toContain('Listen for: family priorities');
  const manual = parseMercuryPreview({ preview: { ...compiled, rules: [] } });
  expect(
    renderMercuryPublication(script, {
      scriptId: 'script',
      savedRevision: 2,
      expectedPublishedVersion: 0,
      requestKey: 21,
      preview: manual,
      pending: false,
    }),
  ).toContain('Manual selection for this card');
});
