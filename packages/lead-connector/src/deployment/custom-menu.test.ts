import { describe, expect, it } from 'bun:test';

import {
  createLeadConnectorCustomMenu,
  upsertLeadConnectorSandboxMenu,
} from './custom-menu';

describe('LeadConnector custom menu deployment contract', () => {
  it('targets one sandbox location in iframe mode with microphone permission', () => {
    expect(
      createLeadConnectorCustomMenu({
        embedUrl: 'https://dialer.example.test/embed/',
        locationId: 'sandbox-location-1',
      }),
    ).toEqual({
      title: 'Consuelo Dialer',
      url: 'https://dialer.example.test/embed/',
      icon: { name: 'phone', fontFamily: 'fas' },
      showOnCompany: false,
      showOnLocation: true,
      showToAllLocations: false,
      locations: ['sandbox-location-1'],
      openMode: 'iframe',
      userRole: 'all',
      allowCamera: false,
      allowMicrophone: true,
    });
  });

  it('updates an existing sandbox menu instead of creating duplicates', async () => {
    const requests: Array<{
      url: string;
      init?: RequestInit;
      version: string | null;
    }> = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({
        url,
        init,
        version: new Headers(init?.headers).get('Version'),
      });
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response(
          JSON.stringify({
            customMenus: [{ id: 'menu-1', title: 'Consuelo Dialer' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ customMenu: { id: 'menu-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const result = await upsertLeadConnectorSandboxMenu(
      {
        accessToken: 'sandbox-token',
        embedUrl: 'https://dialer.example.test/embed/',
        locationId: 'sandbox-location-1',
      },
      fetcher,
    );

    expect(result).toEqual({ customMenuId: 'menu-1', action: 'updated' });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toContain('/custom-menus/?');
    expect(requests[1]).toMatchObject({
      url: 'https://services.leadconnectorhq.com/custom-menus/menu-1',
      init: expect.objectContaining({ method: 'PUT' }),
    });
    expect(requests[1]?.version).toBe('v3');
  });
});
