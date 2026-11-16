import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import {
  createMercuryAuthoringApi,
  renderMercuryPublication,
  type MercuryPublication,
  type MercuryRule,
} from './mercury-authoring';
import { createMercuryAuthoringController } from './mercury-authoring-controller';
import { replaceWorkspace } from './workspace-dom';
import { readScriptFile, type CoachingScript } from './coaching-scripts';

const rule = (cardId: string, aliases: string[]): MercuryRule => ({
  cardId,
  aliases,
  required: [],
  forbidden: [],
  priority: 0,
  speaker: 'customer',
  nextCardIds: [],
});
const fixture = async () => {
  const uploaded = await readScriptFile(
    new File(
      [
        '# Spouse and family\n- Ask who should participate\n- Invite their questions\n- Agree on a follow-up\n\n# Other\n- First point\n- Second point\n- Third point',
      ],
      'reviewed-script.md',
    ),
  );
  const script: CoachingScript = {
    ...uploaded,
    id: 'script',
    revision: 2,
    updatedAt: '',
    canEdit: true,
    canPublish: true,
  };
  const dom = new JSDOM('<main id="app"></main>');
  const root = dom.window.document.querySelector<HTMLElement>('#app')!;
  const defaults = [
    rule('spouse-and-family', ['spouse and family']),
    rule('other', ['other']),
  ];
  let savedRules: MercuryRule[] | undefined,
    ordinal = 0,
    counter = 0;
  let publication: MercuryPublication | undefined,
    selected = script.id;
  const commands: Record<string, unknown>[] = [],
    previewCommands: Record<string, unknown>[] = [];
  const api = createMercuryAuthoringApi({
    baseUrl: 'https://fixture.test',
    getToken: () => 'fixture',
    fetch: async (input, init) => {
      const request = new Request(input, init);
      expect(request.headers.get('authorization')).toBe('Bearer fixture');
      if (request.url.endsWith('/life-insurance'))
        return Response.json({
          label: 'Synthetic examples — require team review before publication',
          rules: [
            'spouse-and-family',
            'existing-coverage',
            'affordability',
            'beneficiaries',
            'employer-coverage',
            'application-and-underwriting',
          ].map((id) =>
            rule(
              id,
              id === 'spouse-and-family'
                ? ['talk to my partner']
                : [id.replaceAll('-', ' ')],
            ),
          ),
        });
      const body = await request.json();
      if (request.url.endsWith('/preview')) {
        previewCommands.push(body);
        const rules = body.rules ?? savedRules ?? defaults;
        return Response.json({
          expectedPublishedVersion: ordinal,
          reviewToken: (++counter).toString(16).padStart(64, '0'),
          preview: {
            rules,
            playbook: {
              cards: [
                {
                  id: 'spouse-and-family',
                  title: 'Spouse and family',
                  slots: [
                    'Ask who should participate',
                    'Invite their questions',
                    'Agree on a follow-up',
                  ],
                },
                {
                  id: 'other',
                  title: 'Other',
                  slots: ['First point', 'Second point', 'Third point'],
                },
              ].map((card) => ({
                ...card,
                slots: card.slots.map((text, i) => ({
                  id: card.id + '-' + i,
                  text,
                  source: {
                    documentId: 'script',
                    revision: String(script.revision),
                    excerpt: text,
                  },
                })),
              })),
            },
          },
        });
      }
      commands.push(body);
      savedRules = body.rules;
      return Response.json({
        version: ++ordinal,
        sourceRevision: script.revision,
      });
    },
  });
  const render = () =>
    replaceWorkspace(root, renderMercuryPublication(script, publication));
  const controller = createMercuryAuthoringController({
    api,
    getScript: (id) => (id === script.id ? script : undefined),
    selectedScriptId: () => selected,
    getPublication: () => publication,
    setPublication: (value) => {
      publication = value;
    },
    nextRequestKey: () => counter++,
    render,
  });
  let pending: Promise<void> | undefined;
  root.addEventListener('input', (event) =>
    controller.input(event.target as Element),
  );
  root.addEventListener('change', (event) =>
    controller.input(event.target as Element),
  );
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    pending = form.hasAttribute('data-trigger-review')
      ? controller.review(form)
      : controller.publish(form);
  });
  const submit = async (selector: string) => {
    root
      .querySelector<HTMLFormElement>(selector)!
      .dispatchEvent(
        new dom.window.Event('submit', { bubbles: true, cancelable: true }),
      );
    await pending;
  };
  await controller.preview(script.id);
  return {
    script,
    root,
    dom,
    controller,
    commands,
    previewCommands,
    submit,
    get publication() {
      return publication!;
    },
    selectOther() {
      selected = 'different';
    },
  };
};

test('ordinary uploaded source uses the actual edit, review, explicit publish and reload handlers', async () => {
  const f = await fixture();
  const approval = () =>
    f.root.querySelector<HTMLInputElement>('[name="approved"]')!;
  const alias = f.root.querySelector<HTMLTextAreaElement>(
    '[name="aliases:spouse-and-family"]',
  )!;
  const oldKey = f.publication.requestKey;
  approval().checked = true;
  alias.value = 'talk to my partner\ncheck with my family';
  alias.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
  expect(approval().checked).toBe(false);
  expect(approval().disabled).toBe(true);
  await f.submit('[data-publication]');
  expect(f.commands).toHaveLength(0);
  await f.submit('[data-trigger-review]');
  expect(f.publication.requestKey).not.toBe(oldKey);
  expect(approval().checked).toBe(false);
  expect(approval().disabled).toBe(false);
  expect(f.publication.preview!.rules[0]!.aliases).toEqual([
    'talk to my partner',
    'check with my family',
  ]);
  await f.submit('[data-publication]');
  expect(f.commands).toHaveLength(0);
  approval().checked = true;
  const reviewed = f.publication.preview!;
  await f.submit('[data-publication]');
  expect(f.commands).toEqual([
    {
      expectedRevision: 2,
      expectedPublishedVersion: 0,
      approved: true,
      rules: reviewed.rules,
      reviewToken: reviewed.reviewToken,
    },
  ]);
  expect(f.root.textContent).toContain('Published version 1');
  await f.controller.preview(f.script.id);
  expect(f.publication.preview!.rules).toEqual(reviewed.rules);
  expect(f.publication.preview!.expectedPublishedVersion).toBe(1);
  expect(approval().checked).toBe(false);
});

test('changed forms without an input event and stale source/selection cannot reuse approval', async () => {
  const f = await fixture();
  f.root.querySelector<HTMLInputElement>('[name="approved"]')!.checked = true;
  f.root.querySelector<HTMLTextAreaElement>(
    '[name="aliases:spouse-and-family"]',
  )!.value = 'an unreviewed phrase';
  await f.submit('[data-publication]');
  expect(f.commands).toHaveLength(0);
  expect(f.publication.dirty).toBe(true);
  expect(
    f.root.querySelector<HTMLInputElement>('[name="approved"]')!.checked,
  ).toBe(false);
  await f.submit('[data-trigger-review]');
  const old = f.root.querySelector<HTMLFormElement>('[data-publication]')!;
  await f.controller.preview(f.script.id);
  old.querySelector<HTMLInputElement>('[name="approved"]')!.checked = true;
  await f.controller.publish(old);
  expect(f.commands).toHaveLength(0);
  f.root.querySelector<HTMLInputElement>('[name="approved"]')!.checked = true;
  f.script.revision++;
  await f.submit('[data-publication]');
  expect(f.commands).toHaveLength(0);
  await f.controller.preview(f.script.id);
  f.root.querySelector<HTMLInputElement>('[name="approved"]')!.checked = true;
  f.selectOther();
  await f.submit('[data-publication]');
  expect(f.commands).toHaveLength(0);
});

test('example triggers are an explicit labeled opt-in, apply only to matching headings and still require approval', async () => {
  const f = await fixture();
  expect(f.publication.preview!.rules[0]!.aliases).toEqual([
    'spouse and family',
  ]);
  const other = f.root.querySelector<HTMLTextAreaElement>(
    '[name="aliases:other"]',
  )!;
  other.value = 'my independently authored phrase';
  other.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
  await f.controller.example(
    f.root.querySelector<HTMLFormElement>('[data-trigger-review]')!,
  );
  expect(f.publication.preview!.rules.map((r) => r.aliases)).toEqual([
    ['talk to my partner'],
    ['my independently authored phrase'],
  ]);
  expect(f.root.textContent).toContain(
    'Synthetic examples — require team review',
  );
  expect(f.root.textContent).toContain('Applied to 1 matching cards');
  expect(
    f.root.querySelector<HTMLInputElement>('[name="approved"]')!.checked,
  ).toBe(false);
  expect(f.commands).toHaveLength(0);
  expect(f.previewCommands).toHaveLength(2);
});
