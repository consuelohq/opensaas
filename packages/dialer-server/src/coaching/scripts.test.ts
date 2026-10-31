import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import type { DialerVariables } from '../middleware/auth';
import { createCoachingRoutes } from '../routes/coaching';
import { validateScriptDraft } from './scripts';
const id = 'a54ae52e-c5d4-4d23-bf33-840b9a351a64';
describe('workspace script boundary', () => {
  it('accepts only bounded text with an explicit revision', () => {
    expect(
      validateScriptDraft({
        title: ' Opening ',
        content: 'Ask a question',
        expectedRevision: 0,
      }),
    ).toEqual({
      title: 'Opening',
      content: 'Ask a question',
      expectedRevision: 0,
    });
    for (const change of [
      { title: '' },
      { content: 'x'.repeat(100001) },
      { content: 'bad\0text' },
      { expectedRevision: -1 },
      { expectedRevision: 1.5 },
    ])
      expect(() =>
        validateScriptDraft({
          title: 'Title',
          content: 'Script',
          expectedRevision: 0,
          ...change,
        }),
      ).toThrow();
  });
  it('takes tenant and author only from authenticated identity', async () => {
    let input: unknown;
    const app = new Hono<{ Variables: DialerVariables }>();
    app.use('*', async (c, next) => {
      c.set('identity', {
        workspaceId: 'trusted',
        userId: 'rep',
        role: 'user',
      });
      await next();
    });
    app.route(
      '/',
      createCoachingRoutes({
        list: async () => [],
        save: async (identity, draft) => {
          input = { identity, draft };
          return { ...draft, revision: 1, updatedAt: 'now', canEdit: true };
        },
      }),
    );
    const response = await app.request('/v1/coaching/scripts/' + id, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'evil',
        userId: 'admin',
        title: 'Title',
        content: 'Script',
        expectedRevision: 0,
      }),
    });
    expect(response.status).toBe(200);
    expect(input).toMatchObject({
      identity: { workspaceId: 'trusted', userId: 'rep' },
      draft: { id, title: 'Title', content: 'Script' },
    });
    expect(
      (input as { draft: Record<string, unknown> }).draft.workspaceId,
    ).toBeUndefined();
  });
  it('returns actionable errors without exposing database diagnostics', async () => {
    const app = new Hono<{ Variables: DialerVariables }>();
    app.use('*', async (c, next) => {
      c.set('identity', { workspaceId: 'w', userId: 'u' });
      await next();
    });
    app.route(
      '/',
      createCoachingRoutes({
        list: async () => {
          throw new Error('secret database URL');
        },
        save: async () => {
          throw new Error('secret database URL');
        },
      }),
    );
    const bad = await app.request('/v1/coaching/scripts/' + id, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(bad.status).toBe(400);
    const failed = await app.request('/v1/coaching/scripts');
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('secret database');
  });
});
