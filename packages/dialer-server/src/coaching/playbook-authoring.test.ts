import { describe, expect, test } from 'bun:test';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import { createPlaybookStore, PlaybookValidationError } from './playbook-store';
import { ScriptConflictError } from './scripts';
import { compilePlaybook, SYNTHETIC_LIFE_INSURANCE } from './playbooks';

const identity = { workspaceId: 'workspace', userId: 'author' };
const id = '11111111-1111-4111-8111-111111111111';
const rules = [
  {
    cardId: 'family',
    aliases: ['check with my partner'],
    required: [],
    forbidden: ['business cover'],
    priority: 45,
    speaker: 'customer',
    nextCardIds: [],
  },
];
const source = {
  id,
  title: 'Family',
  content:
    '# Family\n- Ask who should participate\n- Invite their questions\n- Agree on a follow-up',
  revision: 1,
  created_by: 'author',
};
const fixture = () => {
  let saved = { ...source };
  const publications: {
    version: number;
    source_revision: number;
    compiled: ReturnType<typeof compilePlaybook>;
    created_at: string;
  }[] = [];
  const database = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.startsWith('SELECT id,title,content'))
        return { rows: params[0] === identity.workspaceId ? [saved] : [] };
      if (sql.startsWith('SELECT COALESCE(MAX(version)'))
        return { rows: [{ version: publications.length }] };
      if (sql.includes('ORDER BY version DESC LIMIT 1'))
        return { rows: publications.slice(-1) };
      if (sql.includes('INSERT INTO dialer_coaching_script_publications')) {
        if (params[3] !== saved.revision || params[7] !== publications.length)
          return { rows: [] };
        const row = {
          version: Number(params[2]),
          source_revision: Number(params[3]),
          compiled: JSON.parse(String(params[4])),
          created_at: '2026-11-14T00:00:00Z',
        };
        publications.push(row);
        return { rows: [row] };
      }
      throw new Error('Unexpected test query: ' + sql);
    },
  } as LeadConnectorDatabase;
  return {
    store: createPlaybookStore(database),
    publications,
    changeSource() {
      saved = { ...saved, revision: saved.revision + 1 };
    },
  };
};

describe('reviewed trigger publication', () => {
  test('requires the exact reviewed source, complete rules and publication ordinal before approval can publish', async () => {
    const f = fixture();
    const preview = await f.store.preview(identity, id, {
      expectedRevision: 1,
      rules,
    });
    expect(preview.reviewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.compiled.rules[0]?.aliases).toEqual([
      'check with my partner',
    ]);
    const command = {
      expectedRevision: 1,
      expectedPublishedVersion: 0,
      approved: true,
      rules,
      reviewToken: preview.reviewToken,
    };
    await expect(
      f.store.publish(identity, id, {
        ...command,
        reviewToken: undefined,
      } as never),
    ).rejects.toBeInstanceOf(PlaybookValidationError);
    await expect(
      f.store.publish(identity, id, {
        ...command,
        rules: [{ ...rules[0], aliases: ['a different phrase'] }],
      }),
    ).rejects.toBeInstanceOf(ScriptConflictError);
    expect(f.publications).toHaveLength(0);
    const published = await f.store.publish(identity, id, command);
    expect(published.compiled.rules).toEqual(preview.compiled.rules);
    expect(published.compiled.playbook).toEqual(preview.compiled.playbook);
    await expect(f.store.publish(identity, id, command)).rejects.toBeInstanceOf(
      ScriptConflictError,
    );
  });

  test('reopens published tenant rules, respects explicit manual-only rules, and invalidates approval after source edits', async () => {
    const f = fixture();
    const preview = await f.store.preview(identity, id, {
      expectedRevision: 1,
      rules,
    });
    await f.store.publish(identity, id, {
      expectedRevision: 1,
      expectedPublishedVersion: 0,
      approved: true,
      rules,
      reviewToken: preview.reviewToken,
    });
    const reopened = await f.store.preview(identity, id, {
      expectedRevision: 1,
    });
    expect(reopened.compiled.rules).toEqual(preview.compiled.rules);
    expect(reopened.compiled.version).toBe(2);
    expect(reopened.reviewToken).not.toBe(preview.reviewToken);
    const manual = await f.store.preview(identity, id, {
      expectedRevision: 1,
      rules: [],
    });
    expect(manual.compiled.rules).toEqual([]);
    f.changeSource();
    await expect(
      f.store.publish(identity, id, {
        expectedRevision: 1,
        expectedPublishedVersion: 1,
        approved: true,
        rules,
        reviewToken: reopened.reviewToken,
      }),
    ).rejects.toBeInstanceOf(ScriptConflictError);
    const changed = await f.store.preview(identity, id, {
      expectedRevision: 2,
    });
    expect(changed.compiled.rules[0]?.aliases).toEqual(['family']);
  });

  test('normalizes equivalent reviewed phrases and rejects configuration outside the bounded public contract', async () => {
    const f = fixture();
    const preview = await f.store.preview(identity, id, {
      expectedRevision: 1,
      rules: [{ ...rules[0], aliases: ['Check with my partner!'] }],
    });
    const same = await f.store.preview(identity, id, {
      expectedRevision: 1,
      rules,
    });
    expect(preview.reviewToken).toBe(same.reviewToken);
    for (const invalidRules of [
      [
        {
          ...rules[0],
          aliases: Array.from({ length: 33 }, (_, i) => 'phrase ' + i),
        },
      ],
      [{ ...rules[0], required: ['x'.repeat(81)] }],
      [{ ...rules[0], nextCardIds: ['family', 'family'] }],
      [{ ...rules[0], semanticExpansion: true }],
      [
        {
          ...rules[0],
          aliases: ['alias'],
          required: ['same phrase'],
          forbidden: ['same phrase'],
        },
      ],
    ]) {
      await expect(
        f.store.preview(identity, id, {
          expectedRevision: 1,
          rules: invalidRules,
        }),
      ).rejects.toBeInstanceOf(PlaybookValidationError);
    }
  });

  test('synthetic examples offer explicit independently authored vocabulary and keep review labeling', () => {
    expect(SYNTHETIC_LIFE_INSURANCE.label).toMatch(/Synthetic.*review/);
    const all = SYNTHETIC_LIFE_INSURANCE.rules.flatMap((rule) => rule.aliases);
    expect(all).toContain('policy with another company');
    expect(all).toContain('monthly premium is high');
    expect(all).toContain('talk to my partner');
    expect(all).toContain('who gets the money');
    expect(all).toContain('coverage from my job');
    expect(all).toContain('medical exam');
    expect(
      SYNTHETIC_LIFE_INSURANCE.rules.every((rule) => rule.aliases.length <= 32),
    ).toBe(true);
  });
});

test('authoring routes reject oversized or unreviewed configurations before a publication write', async () => {
  const { Hono } = await import('hono');
  const { createMercuryRoutes } = await import('../routes/mercury');
  const f = fixture();
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('identity' as never, identity as never);
    await next();
  });
  app.route(
    '/',
    createMercuryRoutes({ playbooks: f.store, cues: {} as never }),
  );
  const request = (action: string, body: unknown) =>
    app.request('/v1/coaching/scripts/' + id + '/' + action, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const preview = await request('preview', { expectedRevision: 1, rules });
  expect(preview.status).toBe(200);
  const reviewed = await preview.json();
  const command = {
    expectedRevision: 1,
    expectedPublishedVersion: 0,
    approved: true,
    rules: reviewed.preview.rules,
    reviewToken: reviewed.reviewToken,
  };
  for (const input of [
    null,
    [],
    { ...command, reviewToken: undefined },
    { ...command, rules: undefined },
    { ...command, approved: false },
    { ...command, workspaceId: 'foreign' },
    { ...command, industryPackVersion: 'unapproved' },
  ])
    expect((await request('publish', input)).status).toBe(400);
  expect(
    (
      await request('preview', {
        expectedRevision: 1,
        rules: [{ ...rules[0], aliases: Array(33).fill('phrase') }],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request('preview', {
        expectedRevision: 1,
        rules: [],
        padding: 'x'.repeat(1024 * 1024),
      })
    ).status,
  ).toBe(413);
  expect(f.publications).toHaveLength(0);
  expect((await request('publish', command)).status).toBe(200);
});

test('complete authored rules have a bounded aggregate size even when individual fields are valid', () => {
  const content = Array.from(
    { length: 100 },
    (_, i) =>
      '# Card ' +
      i +
      '\n- First approved point\n- Second approved point\n- Third approved point',
  ).join('\n');
  const rules = Array.from({ length: 100 }, (_, i) => ({
    cardId: 'card-' + i,
    priority: 0,
    aliases: Array.from(
      { length: 32 },
      (_, p) => 'alias ' + p + ' ' + 'a'.repeat(65),
    ),
    required: Array.from(
      { length: 32 },
      (_, p) => 'required ' + p + ' ' + 'a'.repeat(65),
    ),
    forbidden: Array.from(
      { length: 32 },
      (_, p) => 'forbidden ' + p + ' ' + 'a'.repeat(65),
    ),
  }));
  expect(() =>
    compilePlaybook({
      workspaceId: 'workspace',
      scriptId: id,
      sourceRevision: 1,
      version: 1,
      title: 'Bounded',
      content,
      rules,
      industryPackVersion: 'unclassified-tenant-text-v1',
      companyPolicyVersion: 'tenant-source',
    }),
  ).toThrow('512 KB');
});

test('canonical trigger length stays bounded after Unicode normalization', async () => {
  const f = fixture();
  await expect(
    f.store.preview(identity, id, {
      expectedRevision: 1,
      rules: [{ ...rules[0], aliases: ['ﬃ'.repeat(40)] }],
    }),
  ).rejects.toBeInstanceOf(PlaybookValidationError);
});
