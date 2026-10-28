import { describe, expect, it } from 'bun:test';

import { resolveLeadConnectorContactName } from './contact-label';

describe('LeadConnector contact labels', () => {
  it('falls back to first and last name when the provider name field is empty', () => {
    expect(
      resolveLeadConnectorContactName({
        id: 'contact-1',
        firstName: 'Casey',
        lastName: 'Morgan',
        name: null,
        email: 'casey@example.test',
        phone: '+15550104567',
        tags: [],
      }),
    ).toBe('Casey Morgan');
  });

  it('uses email only when no provider or structured name exists', () => {
    expect(
      resolveLeadConnectorContactName({
        id: 'contact-2',
        firstName: null,
        lastName: null,
        name: ' ',
        email: 'operator@example.test',
        phone: '+15550109546',
        tags: [],
      }),
    ).toBe('operator@example.test');
  });
});
