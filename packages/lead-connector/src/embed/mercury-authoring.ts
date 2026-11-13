import {
  createMercuryJsonRequest,
  type MercuryRequestOptions,
} from './mercury-feed-api.js';
import type { CoachingScript } from './coaching-scripts.js';
import { escapeHtml as e } from './workspace-format.js';

export type MercuryPreview = {
  cards: {
    id: string;
    title: string;
    listenFor: string[];
    points: { id: string; text: string; exact: string; source: string }[];
  }[];
};
export type MercuryPublication = {
  scriptId: string;
  savedRevision: number;
  expectedPublishedVersion: number;
  requestKey: number;
  preview?: MercuryPreview;
  pending: boolean;
  error?: string;
  publishedVersion?: number;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const invalid = (): never => {
  throw new Error('The playbook preview could not be verified.');
};
export const parseMercuryPreview = (input: unknown): MercuryPreview => {
  if (
    !record(input) ||
    !record(input.preview) ||
    !record(input.preview.playbook) ||
    !Array.isArray(input.preview.playbook.cards)
  )
    return invalid();
  const cards = input.preview.playbook.cards;
  if (cards.length < 1 || cards.length > 256) return invalid();
  const listening = new Map<string, string[]>();
  const rules = input.preview.rules;
  if (rules !== undefined && (!Array.isArray(rules) || rules.length > 1000))
    return invalid();
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (
      !record(rule) ||
      !text(rule.cardId, 200) ||
      !cards.some((card) => record(card) && card.id === rule.cardId) ||
      !Array.isArray(rule.aliases) ||
      rule.aliases.length > 128
    )
      return invalid();
    const aliases: string[] = [];
    for (const alias of rule.aliases) {
      if (!text(alias, 200)) return invalid();
      aliases.push(alias);
    }
    const combined = [
      ...new Set([...(listening.get(rule.cardId) ?? []), ...aliases]),
    ];
    if (combined.length > 128) return invalid();
    listening.set(rule.cardId, combined);
  }
  const ids = new Set<string>();
  return {
    cards: cards.map((card) => {
      if (
        !record(card) ||
        !text(card.id, 200) ||
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
        listenFor: listening.get(card.id) ?? [],
        points: card.slots.map((slot) => {
          if (
            !record(slot) ||
            !text(slot.id, 200) ||
            slots.has(slot.id) ||
            !text(slot.text, 200) ||
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
            source: `${slot.source.documentId} · revision ${slot.source.revision}`,
          };
        }),
      };
    }),
  };
};

export const createMercuryAuthoringApi = (options: MercuryRequestOptions) => {
  const request = createMercuryJsonRequest(options);
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
            typeof version.version !== 'number' ||
            !Number.isSafeInteger(version.version) ||
            version.version < 1
          )
            return invalid();
          return version.version;
        });
      }),
    preview: (id: string, expectedRevision: number) =>
      request(path(id) + '/preview', {
        method: 'POST',
        body: JSON.stringify({ expectedRevision }),
      }).then(parseMercuryPreview),
    publish: (
      id: string,
      command: {
        expectedRevision: number;
        expectedPublishedVersion: number;
        approved: true;
      },
    ): Promise<{ version: number }> => {
      if (command.approved !== true)
        return Promise.reject(new Error('Explicit approval is required.'));
      return request(path(id) + '/publish', {
        method: 'POST',
        body: JSON.stringify({
          expectedRevision: command.expectedRevision,
          expectedPublishedVersion: command.expectedPublishedVersion,
          approved: true,
        }),
      }).then((result) => {
        if (
          !record(result) ||
          typeof result.version !== 'number' ||
          !Number.isSafeInteger(result.version) ||
          result.version < 1 ||
          result.sourceRevision !== command.expectedRevision
        )
          return invalid();
        return { version: result.version };
      });
    },
  };
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
  return `<section class="settings-section mercury-publication" aria-label="Publish approved playbook"><h2>Approved talking points</h2><p class="form-caption">Use a heading with 3–4 short, approved bullet points for each card. Preview the exact points and source before publishing.</p>
  ${current?.error ? `<p role="alert">${e(current.error)}</p>` : ''}${current?.publishedVersion ? `<p role="status">Published version ${current.publishedVersion}. Active calls keep their existing version.</p>` : ''}
  <button type="button" class="button button--secondary" data-action="script-preview" data-script-id="${e(script.id)}"${current?.pending ? ' disabled' : ''}>${current?.pending ? 'Working…' : 'Preview talking points'}</button>
  ${
    current?.preview
      ? `<div class="publication-preview">${current.preview.cards.map((card) => `<article><h3>${e(card.title)}</h3><p class="form-caption">${card.listenFor.length ? 'Listen for: ' + e(card.listenFor.join(' · ')) : 'Manual selection for this card.'}</p><ul>${card.points.map((point) => `<li><strong>${e(point.text)}</strong><details><summary>Source &amp; exact wording</summary><p>${e(point.source)}</p><p>${e(point.exact)}</p></details></li>`).join('')}</ul></article>`).join('')}</div>
  <form data-publication data-preview-key="${current.requestKey}" data-form="coaching-publication-${current.requestKey}"><label class="option-toggle"><input type="checkbox" name="approved" required /><span>I approve these exact points and source wording for this saved revision.</span></label><p class="form-caption">Publishing approves this reference. Live assistance also requires your workspace’s call and capture policy.</p><button type="submit" class="button button--primary"${current.pending ? ' disabled' : ''}>Publish approved version</button></form>`
      : ''
  }
  </section>`;
};
