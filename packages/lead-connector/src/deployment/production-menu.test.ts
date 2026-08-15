import { describe, expect, it } from 'bun:test';

import {
  createLeadConnectorCustomMenu,
  updateLeadConnectorProductionMenu,
} from './custom-menu';

describe('LeadConnector production custom menu deployment', () => {
  it('updates one configured menu id and verifies exact persisted read-back', async () => {
    const desired = createLeadConnectorCustomMenu({
      embedUrl: 'https://calls.consuelohq.com',
      locationId: 'location-prod',
    });
    const requests: Array<{ url: string; method: string; body?: unknown }> = [];
    let persisted = { ...desired, url: 'https://old.example.test/admin' };
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      requests.push({
        url,
        method,
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
      });
      expect(new Headers(init?.headers).get('Version')).toBe('v3');
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer production-token',
      );
      if (method === 'PUT') {
        persisted = JSON.parse(String(init?.body)) as typeof persisted;
        return new Response(
          JSON.stringify({ customMenu: { id: 'menu-prod' } }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      if (requests.length === 1) {
        return new Response(JSON.stringify({ id: 'menu-prod', ...persisted }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ customMenu: { id: 'menu-prod', ...persisted } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const result = await updateLeadConnectorProductionMenu(
      {
        accessToken: 'production-token',
        customMenuId: 'menu-prod',
        embedUrl: 'https://calls.consuelohq.com',
        locationId: 'location-prod',
      },
      fetcher,
    );

    expect(requests.map(({ method }) => method)).toEqual(['GET', 'PUT', 'GET']);
    expect(
      requests.every(({ url }) => url.endsWith('/custom-menus/menu-prod')),
    ).toBe(true);
    expect(requests[1]?.body).toEqual(desired);
    expect(result).toEqual({ customMenuId: 'menu-prod', menu: desired });
  });

  it('fails closed when the configured id belongs to a different menu', async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          customMenu: {
            id: 'menu-prod',
            ...createLeadConnectorCustomMenu({
              embedUrl: 'https://calls.consuelohq.com',
              locationId: 'location-prod',
            }),
            title: 'Another Product',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    await expect(
      updateLeadConnectorProductionMenu(
        {
          accessToken: 'production-token',
          customMenuId: 'menu-prod',
          embedUrl: 'https://calls.consuelohq.com',
          locationId: 'location-prod',
        },
        fetcher,
      ),
    ).rejects.toThrow(
      'configured custom menu does not belong to Consuelo Dialer',
    );
  });
});
