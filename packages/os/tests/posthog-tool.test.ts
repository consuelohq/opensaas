import { describe, expect, it, vi } from 'vitest';
import { createPosthogClient, resolvePosthogConfig } from '../scripts/lib/posthog-client';

const usConfig = {
  apiHost: 'https://us.posthog.com',
  ingestHost: 'https://us.i.posthog.com',
  projectId: '42',
  personalApiKey: 'phx_private_test_only',
  projectToken: 'phc_public_test_only',
} as const;

describe('PostHog OS client', () => {
  it('reports only configuration presence and resolves EU region separately for private/public APIs', () => {
    const config = resolvePosthogConfig({
      POSTHOG_REGION: 'eu',
      POSTHOG_PERSONAL_API_KEY: 'phx_hidden',
      POSTHOG_PROJECT_TOKEN: 'phc_hidden',
      POSTHOG_PROJECT_ID: '101',
    }, () => null);
    expect(config.apiHost).toBe('https://eu.posthog.com');
    expect(config.ingestHost).toBe('https://eu.i.posthog.com');
    const client = createPosthogClient({ config });
    expect(client.status()).toEqual({
      region: 'eu',
      apiHost: 'https://eu.posthog.com',
      ingestHost: 'https://eu.i.posthog.com',
      hasPersonalApiKey: true,
      hasProjectToken: true,
      hasProjectId: true,
    });
    expect(JSON.stringify(client.status())).not.toContain('phx_hidden');
    expect(JSON.stringify(client.status())).not.toContain('phc_hidden');
  });

  it('queries with private key and exact project, bounded output and no key leakage', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      columns: ['event', 'count'],
      results: Array.from({ length: 125 }, (_, i) => ['event' + i, i]),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = createPosthogClient({ config: usConfig, fetchImpl });
    const result = await client.query({ sql: 'SELECT event, count() FROM events GROUP BY event', projectId: '42', limit: 20 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://us.posthog.com/api/projects/42/query/');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer phx_private_test_only');
    expect(JSON.parse(String(init.body)).query).toMatchObject({ kind: 'HogQLQuery', query: 'SELECT event, count() FROM events GROUP BY event' });
    expect(result.rows).toHaveLength(20);
    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result)).not.toContain('phx_private_test_only');
  });

  it('lists projects with private API key and enforces limit', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ results: [{ id: 42, name: 'Consuelo' }] }));
    const result = await createPosthogClient({ config: usConfig, fetchImpl }).projects({ limit: 3 });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://us.posthog.com/api/projects/?limit=3');
    expect(result.projects).toEqual([{ id: 42, name: 'Consuelo' }]);
  });

  it('captures explicit events with project token on ingestion host and not private key', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ status: 1 }));
    const result = await createPosthogClient({ config: usConfig, fetchImpl }).capture({
      event: 'website_cta_clicked',
      distinctId: 'anon_abcdef',
      properties: { source: 'website', placement: 'hero' },
    });
    expect(result).toMatchObject({ accepted: true, event: 'website_cta_clicked' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://us.i.posthog.com/i/v0/e/');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ api_key: 'phc_public_test_only', event: 'website_cta_clicked', distinct_id: 'anon_abcdef' });
    expect(String(init.body)).not.toContain('phx_private_test_only');
    expect(JSON.stringify(result)).not.toContain('phc_public_test_only');
  });

  it('blocks sensitive attributes and identifiers before any provider network call', async () => {
    const fetchImpl = vi.fn();
    const client = createPosthogClient({ config: usConfig, fetchImpl });
    await expect(client.capture({ event: 'test', distinctId: 'anon_1', properties: { customer_phone: '555-000-0000' } })).rejects.toThrow(/sensitive/i);
    await expect(client.capture({ event: 'test', distinctId: 'user@example.com' })).rejects.toThrow(/distinct/i);
    await expect(client.capture({ event: 'test', distinctId: 'anon_1', properties: { transcript: 'private conversation' } })).rejects.toThrow(/sensitive/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed when private API credentials are absent or host is invalid', async () => {
    const fetchImpl = vi.fn();
    const config = { ...usConfig, personalApiKey: undefined };
    await expect(createPosthogClient({ config, fetchImpl }).query({ sql: 'SELECT 1' })).rejects.toThrow(/personal api key/i);
    expect(() => resolvePosthogConfig({ POSTHOG_HOST: 'http://localhost:3000' }, () => null)).toThrow(/https/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not return error bodies or secrets from failed requests', async () => {
    const fetchImpl = vi.fn(async () => new Response('phx_private_test_only bad credential', { status: 401 }));
    const client = createPosthogClient({ config: usConfig, fetchImpl });
    await expect(client.projects()).rejects.toThrow(/HTTP 401/);
    try { await client.projects(); } catch (error: unknown) {
      expect(String(error)).not.toContain('phx_private_test_only');
    }
  });

  it('rejects unsafe SQL/multi-statements rather than blindly invoking query API', async () => {
    const fetchImpl = vi.fn();
    const client = createPosthogClient({ config: usConfig, fetchImpl });
    await expect(client.query({ sql: 'DELETE FROM events' })).rejects.toThrow(/read-only/i);
    await expect(client.query({ sql: 'SELECT 1; SELECT 2' })).rejects.toThrow(/single/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
