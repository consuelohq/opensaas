import { describe, expect, it } from 'bun:test';
import { createLeadConnectorInboundEnrichment } from './inbound-enrichment';

describe('runtime CRM owner adapter', () => {
  it('does not query CRM for withheld or invalid caller identity', async () => {
    let loads = 0;
    const enrich = createLeadConnectorInboundEnrichment(async () => {
      loads++;
      throw new Error('Should not load CRM');
    });
    for (const caller of ['', 'anonymous', '+10000000000']) {
      expect(await enrich({ workspaceId: 'workspace', caller })).toMatchObject({
        ownerRepId: null, ownerStatus: 'missing',
      });
    }
    expect(loads).toBe(0);
  });

  it('retries failed initialization for a later valid caller', async () => {
    let loads = 0;
    const enrich = createLeadConnectorInboundEnrichment(async () => {
      loads++;
      throw new Error('Initialization unavailable');
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(enrich({ workspaceId: 'workspace', caller: '(415) 555-2671' }))
        .rejects.toThrow('Inbound CRM owner lookup unavailable');
    }
    expect(loads).toBe(2);
  });
});
