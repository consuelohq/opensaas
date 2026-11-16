import {
  createMercuryJsonRequest,
  type MercuryRequestOptions,
} from './mercury-feed-api.js';
import type { CoachingScript } from './coaching-scripts.js';
import { escapeHtml as e } from './workspace-format.js';

export type MercuryRule = {
  cardId: string;
  aliases: string[];
  required: string[];
  forbidden: string[];
  priority: number;
  speaker: 'customer' | 'rep' | 'either';
  nextCardIds: string[];
};
export type MercuryPreview = {
  cards: {
    id: string;
    title: string;
    listenFor: string[];
    points: { id: string; text: string; exact: string; source: string }[];
  }[];
  rules: MercuryRule[];
  reviewToken: string;
  expectedPublishedVersion: number;
};
export type MercuryPublication = {
  scriptId: string;
  savedRevision: number;
  expectedPublishedVersion: number;
  requestKey: number;
  preview?: MercuryPreview;
  draftRules?: MercuryRule[];
  dirty?: boolean;
  pending: boolean;
  error?: string;
  publishedVersion?: number;
  exampleLabel?: string;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const invalid = (): never => {
  throw new Error('The playbook preview could not be verified.');
};
const normalizePhrase = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const phraseList = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length > 32) return invalid();
  const result = value.map((phrase) => {
    if (
      !text(phrase, 80) ||
      /[\u0000-\u001f]/.test(phrase) ||
      !normalizePhrase(phrase) ||
      normalizePhrase(phrase).length > 80
    )
      return invalid();
    return normalizePhrase(phrase);
  });
  if (new Set(result).size !== result.length) return invalid();
  return result;
};
const parseRules = (
  raw: unknown,
  cardIds: readonly unknown[],
): MercuryRule[] => {
  if (
    !Array.isArray(raw) ||
    raw.length > cardIds.length ||
    new TextEncoder().encode(JSON.stringify(raw)).length > 512 * 1024
  )
    return invalid();
  const ids = new Set<string>();
  return raw.map((rule) => {
    if (
      !record(rule) ||
      !text(rule.cardId, 128) ||
      !cardIds.includes(rule.cardId) ||
      ids.has(rule.cardId) ||
      Object.keys(rule).some(
        (key) =>
          ![
            'cardId',
            'aliases',
            'required',
            'forbidden',
            'priority',
            'speaker',
            'nextCardIds',
          ].includes(key),
      ) ||
      !Number.isInteger(rule.priority) ||
      Number(rule.priority) < 0 ||
      Number(rule.priority) > 100 ||
      !['customer', 'rep', 'either'].includes(String(rule.speaker)) ||
      !Array.isArray(rule.nextCardIds) ||
      rule.nextCardIds.length > 16 ||
      new Set(rule.nextCardIds).size !== rule.nextCardIds.length ||
      rule.nextCardIds.some((id) => !cardIds.includes(id))
    )
      return invalid();
    ids.add(rule.cardId);
    const required = phraseList(rule.required),
      forbidden = phraseList(rule.forbidden);
    if (required.some((phrase) => forbidden.includes(phrase))) return invalid();
    return {
      cardId: rule.cardId,
      aliases: phraseList(rule.aliases),
      required,
      forbidden,
      priority: Number(rule.priority),
      speaker: rule.speaker as MercuryRule['speaker'],
      nextCardIds: rule.nextCardIds as string[],
    };
  });
};
export const parseMercuryPreview = (input: unknown): MercuryPreview => {
  if (
    !record(input) ||
    typeof input.reviewToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.reviewToken) ||
    !Number.isSafeInteger(input.expectedPublishedVersion) ||
    Number(input.expectedPublishedVersion) < 0 ||
    !record(input.preview) ||
    !record(input.preview.playbook) ||
    !Array.isArray(input.preview.playbook.cards)
  )
    return invalid();
  const cards = input.preview.playbook.cards;
  if (cards.length < 1 || cards.length > 512) return invalid();
  const rules = parseRules(
    input.preview.rules,
    cards.map((card) => (record(card) ? card.id : undefined)),
  );
  const ids = new Set<string>();
  return {
    rules,
    reviewToken: input.reviewToken,
    expectedPublishedVersion: Number(input.expectedPublishedVersion),
    cards: cards.map((card) => {
      if (
        !record(card) ||
        !text(card.id, 128) ||
        ids.has(card.id) ||
        !text(card.title, 200) ||
        !Array.isArray(card.slots) ||
        card.slots.length < 3 ||
        card.slots.length > 4
      )
        return invalid();
      ids.add(card.id);
      const slots = new Set<string>();
      return {
        id: card.id,
        title: card.title,
        listenFor: rules.find((rule) => rule.cardId === card.id)?.aliases ?? [],
        points: card.slots.map((slot) => {
          if (
            !record(slot) ||
            !text(slot.id, 200) ||
            slots.has(slot.id) ||
            !text(slot.text, 256) ||
            !record(slot.source) ||
            !text(slot.source.documentId, 200) ||
            !text(slot.source.excerpt, 20_000) ||
            !(
              text(slot.source.revision, 200) ||
              (typeof slot.source.revision === 'number' &&
                Number.isSafeInteger(slot.source.revision) &&
                slot.source.revision >= 0)
            )
          )
            return invalid();
          slots.add(slot.id);
          return {
            id: slot.id,
            text: slot.text,
            exact: slot.source.excerpt,
            source:
              slot.source.documentId + ' · revision ' + slot.source.revision,
          };
        }),
      };
    }),
  };
};

export const createMercuryAuthoringApi = (options: MercuryRequestOptions) => {
  // Source excerpts repeat for each point. Retain the authoring transport budget.
  const request = createMercuryJsonRequest(options, 4 * 1024 * 1024);
  const path = (id: string) => '/v1/coaching/scripts/' + encodeURIComponent(id);
  return {
    versions: (id: string): Promise<number[]> =>
      request(path(id) + '/versions').then((result) => {
        if (
          !record(result) ||
          !Array.isArray(result.versions) ||
          result.versions.length > 1000
        )
          return invalid();
        return result.versions.map((version) => {
          if (
            !record(version) ||
            !Number.isSafeInteger(version.version) ||
            Number(version.version) < 1
          )
            return invalid();
          return Number(version.version);
        });
      }),
    example: (): Promise<{ label: string; rules: MercuryRule[] }> =>
      request('/v1/coaching/examples/life-insurance').then((result) => {
        if (
          !record(result) ||
          !text(result.label, 200) ||
          !Array.isArray(result.rules) ||
          result.rules.length !== 6
        )
          return invalid();
        const raw = result.rules.map((rule) =>
          record(rule)
            ? {
                ...rule,
                required: rule.required ?? [],
                forbidden: rule.forbidden ?? [],
                speaker: rule.speaker ?? 'customer',
                nextCardIds: rule.nextCardIds ?? [],
              }
            : rule,
        );
        return {
          label: result.label,
          rules: parseRules(
            raw,
            raw.map((rule) => (record(rule) ? rule.cardId : undefined)),
          ),
        };
      }),
    preview: (id: string, expectedRevision: number, rules?: MercuryRule[]) =>
      request(path(id) + '/preview', {
        method: 'POST',
        body: JSON.stringify({
          expectedRevision,
          ...(rules !== undefined ? { rules } : {}),
        }),
      }).then(parseMercuryPreview),
    publish: (
      id: string,
      command: {
        expectedRevision: number;
        expectedPublishedVersion: number;
        approved: true;
        rules: MercuryRule[];
        reviewToken: string;
      },
    ): Promise<{ version: number }> => {
      if (
        command.approved !== true ||
        !Array.isArray(command.rules) ||
        !/^[a-f0-9]{64}$/.test(command.reviewToken)
      )
        return Promise.reject(
          new Error(
            'Review these points and triggers, then explicitly approve them.',
          ),
        );
      return request(path(id) + '/publish', {
        method: 'POST',
        body: JSON.stringify({
          expectedRevision: command.expectedRevision,
          expectedPublishedVersion: command.expectedPublishedVersion,
          approved: true,
          rules: command.rules,
          reviewToken: command.reviewToken,
        }),
      }).then((result) => {
        if (
          !record(result) ||
          !Number.isSafeInteger(result.version) ||
          Number(result.version) < 1 ||
          result.sourceRevision !== command.expectedRevision
        )
          return invalid();
        return { version: Number(result.version) };
      });
    },
  };
};
export const editableMercuryRules = (preview: MercuryPreview): MercuryRule[] =>
  preview.cards.map(
    (card) =>
      preview.rules.find((rule) => rule.cardId === card.id) ?? {
        cardId: card.id,
        aliases: [],
        required: [],
        forbidden: [],
        priority: 0,
        speaker: 'customer',
        nextCardIds: [],
      },
  );
const formError = (message: string): never => {
  throw new Error(message);
};
export const readMercuryTriggerForm = (
  data: Pick<FormData, 'get'>,
  preview: MercuryPreview,
): MercuryRule[] =>
  preview.cards.map((card) => {
    const lines = (field: string, count = 32, max = 80) => {
      const value = data.get(field + ':' + card.id);
      if (typeof value !== 'string')
        return formError('Reopen the trigger editor before reviewing.');
      const phrases = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (
        phrases.length > count ||
        phrases.some(
          (phrase) => phrase.length > max || /[\u0000-\u001f]/.test(phrase),
        )
      )
        return formError(
          'Use at most ' +
            count +
            ' entries of ' +
            max +
            ' characters in each trigger field.',
        );
      return phrases;
    };
    const aliases = phraseList(lines('aliases')),
      required = phraseList(lines('required')),
      forbidden = phraseList(lines('forbidden'));
    if (required.some((phrase) => forbidden.includes(phrase)))
      return formError('A phrase cannot be both required and forbidden.');
    const value = data.get('priority:' + card.id);
    const priority =
      typeof value === 'string' && /^\d{1,3}$/.test(value)
        ? Number(value)
        : NaN;
    const speaker = data.get('speaker:' + card.id);
    if (
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 100 ||
      !['customer', 'rep', 'either'].includes(String(speaker))
    )
      return formError('Choose a speaker and a priority from 0 to 100.');
    const nextCardIds = lines('next', 16, 200).map((title) => {
      const next = preview.cards.find(
        (candidate) =>
          candidate.title.normalize('NFKC').toLowerCase() ===
          title.normalize('NFKC').toLowerCase(),
      );
      return (
        next?.id ??
        formError(
          'Use a card heading shown in this preview for each next card.',
        )
      );
    });
    if (new Set(nextCardIds).size !== nextCardIds.length)
      return formError('List each next card once.');
    return {
      cardId: card.id,
      aliases,
      required,
      forbidden,
      priority,
      speaker: speaker as MercuryRule['speaker'],
      nextCardIds,
    };
  });
/** Clear approval synchronously on input; subsequent redraws keep it disabled. */
export const invalidateMercuryApproval = (
  state: MercuryPublication,
  root: ParentNode,
): void => {
  state.dirty = true;
  for (const approval of root.querySelectorAll<HTMLInputElement>(
    '[data-publication] [name="approved"]',
  )) {
    approval.checked = false;
    approval.disabled = true;
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-publication] button',
  ))
    button.disabled = true;
  const notice = root.querySelector<HTMLElement>('[data-trigger-notice]');
  if (notice)
    notice.textContent =
      'Review trigger changes before approving. Unpublished edits stay in this preview.';
};

export const renderMercuryPublication = (
  script: CoachingScript,
  state?: MercuryPublication,
): string => {
  if (script.canPublish !== true)
    return '<p class="form-caption">This saved script is available as a manual reference.</p>';
  const current =
    state?.scriptId === script.id && state.savedRevision === script.revision
      ? state
      : undefined;
  const disabled = current?.pending ? ' disabled' : '',
    preview = current?.preview;
  const ruleFields = (card: MercuryPreview['cards'][number]) => {
    const rule = (current?.draftRules ?? editableMercuryRules(preview!)).find(
      (item) => item.cardId === card.id,
    )!;
    const area = (field: string, label: string, values: string[], max = 2592) =>
      '<label>' +
      label +
      '<textarea name="' +
      field +
      ':' +
      e(card.id) +
      '" rows="2" maxlength="' +
      max +
      '">' +
      e(values.join('\n')) +
      '</textarea></label>';
    return (
      '<details data-disclosure="triggers-' +
      e(card.id) +
      '"><summary>Edit when this card appears</summary>' +
      area('aliases', 'Listen for — one phrase per line', rule.aliases) +
      '<p class="form-caption">Up to 32 reviewed phrases, 80 characters each. Leave blank for manual selection. Add the wording your customers use.</p>' +
      '<details data-disclosure="context-' +
      e(card.id) +
      '"><summary>Context and routing</summary>' +
      area(
        'required',
        'Require all these phrases in recent confirmed context',
        rule.required,
      ) +
      area(
        'forbidden',
        'Do not suggest when any of these phrases appears in recent context',
        rule.forbidden,
      ) +
      '<label>Who says the trigger?<select name="speaker:' +
      e(card.id) +
      '">' +
      (['customer', 'rep', 'either'] as const)
        .map(
          (speaker) =>
            '<option value="' +
            speaker +
            '"' +
            (rule.speaker === speaker ? ' selected' : '') +
            '>' +
            {
              customer: 'Customer',
              rep: 'Representative',
              either: 'Either speaker',
            }[speaker] +
            '</option>',
        )
        .join('') +
      '</select></label><label>Priority (0–100)<input type="number" name="priority:' +
      e(card.id) +
      '" min="0" max="100" step="1" value="' +
      rule.priority +
      '" required /></label>' +
      area(
        'next',
        'Next cards — optional headings, one per line',
        rule.nextCardIds.map(
          (id) => preview!.cards.find((next) => next.id === id)!.title,
        ),
        3216,
      ) +
      '<p class="form-caption">A higher priority resolves competing cards. Next cards break ties between equally ranked matches; leave blank for no preference.</p></details></details>'
    );
  };
  return (
    '<section class="settings-section mercury-publication" aria-label="Publish approved playbook"><h2>Approved talking points</h2>' +
    '<p class="form-caption">Use a heading with 3–4 short, approved bullet points per card. Review the points, listening phrases and source before publishing.</p>' +
    (current?.error ? '<p role="alert">' + e(current.error) + '</p>' : '') +
    (current?.publishedVersion
      ? '<p role="status">Published version ' +
        current.publishedVersion +
        '. Active calls keep their existing version.</p>'
      : '') +
    '<button type="button" class="button button--secondary" data-action="script-preview" data-script-id="' +
    e(script.id) +
    '"' +
    disabled +
    '>' +
    (current?.pending
      ? 'Working…'
      : preview
        ? 'Reload published triggers'
        : 'Preview talking points') +
    '</button>' +
    (preview
      ? '<form data-trigger-review data-preview-key="' +
        current!.requestKey +
        '" data-form="coaching-triggers-' +
        current!.requestKey +
        '"><fieldset' +
        disabled +
        '><legend class="sr-only">Review card triggers</legend>' +
        '<details data-disclosure="example-triggers"><summary>Life insurance example</summary><p class="form-caption">Synthetic examples require your team’s review. Apply only to matching example headings; other cards keep their current triggers.</p>' +
        '<button type="button" class="button button--secondary" data-action="script-example-triggers"' +
        disabled +
        '>Use life insurance example triggers</button></details>' +
        (current?.exampleLabel
          ? '<p class="form-caption" role="status">' +
            e(current.exampleLabel) +
            '</p>'
          : '') +
        '<div class="publication-preview">' +
        preview.cards
          .map(
            (card) =>
              '<article><h3>' +
              e(card.title) +
              '</h3><p class="form-caption">' +
              (card.listenFor.length
                ? 'Listen for: ' + e(card.listenFor.join(' · '))
                : 'Manual selection for this card.') +
              '</p>' +
              ruleFields(card) +
              '<ul>' +
              card.points
                .map(
                  (point) =>
                    '<li><strong>' +
                    e(point.text) +
                    '</strong><details><summary>Source &amp; exact wording</summary><p>' +
                    e(point.source) +
                    '</p><p>' +
                    e(point.exact) +
                    '</p></details></li>',
                )
                .join('') +
              '</ul></article>',
          )
          .join('') +
        '</div><p class="form-caption" data-trigger-notice>' +
        (current?.dirty ? 'Review trigger changes before approving. ' : '') +
        'Unpublished trigger edits stay in this preview until publication. Reloading restores the last published triggers for this saved revision.</p>' +
        '<button type="submit" class="button button--secondary">Review trigger changes</button></fieldset></form>' +
        '<form data-publication data-preview-key="' +
        current!.requestKey +
        '" data-form="coaching-publication-' +
        current!.requestKey +
        '"><label class="option-toggle"><input type="checkbox" name="approved" required' +
        (current?.dirty || current?.pending ? ' disabled' : '') +
        ' /><span>I approve these exact points, trigger rules and source wording for this saved revision.</span></label>' +
        '<p class="form-caption">Publishing approves this reference. Live assistance also requires your workspace’s call and capture policy.</p><button type="submit" class="button button--primary"' +
        (current?.dirty || current?.pending ? ' disabled' : '') +
        '>Publish approved version</button></form>'
      : '') +
    '</section>'
  );
};
