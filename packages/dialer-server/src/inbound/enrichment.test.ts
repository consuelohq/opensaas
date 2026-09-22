import { describe, expect, it } from 'bun:test';
import { resolveInboundEnrichment } from './enrichment';

const input = { workspaceId: 'workspace', caller: '+14155552671' };
const owner = {
  requiredSkills: [], ownerRepId: 'alice', ownerStatus: 'known' as const,
  kind: 'live' as const, notBefore: null, deadline: null,
};

describe('bounded inbound enrichment', () => {
  it('preserves normalized owner facts without overriding routing eligibility', async () => {
    expect(await resolveInboundEnrichment(async (request) => {
      expect(request).toEqual(input);
      return owner;
    }, input)).toEqual(owner);
  });

  it('uses missing ownership when there is no integration', async () => {
    expect(await resolveInboundEnrichment(undefined, input)).toMatchObject({
      ownerRepId: null, ownerStatus: 'missing', kind: 'live',
    });
  });

  it('falls back after provider failure or a non-live result', async () => {
    for (const enrich of [
      async () => { throw new Error('CRM unavailable'); },
      async () => ({ ...owner, kind: 'callback' as const }),
    ]) {
      expect(await resolveInboundEnrichment(enrich, input)).toMatchObject({
        ownerRepId: null, ownerStatus: 'unavailable', kind: 'live',
      });
    }
  });

  it('bounds a stalled CRM lookup so the caller can enter team routing', async () => {
    const started = Date.now();
    expect(await resolveInboundEnrichment(() => new Promise(() => {}), input))
      .toMatchObject({ ownerRepId: null, ownerStatus: 'unavailable' });
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
