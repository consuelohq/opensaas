import { describe, expect, it } from 'bun:test';

import { hasEnabledCustomerEntry } from './inbound';

describe('inbound customer-entry runtime activation', () => {
  it('ignores customer-entry configuration on disabled numbers', () => {
    expect(
      hasEnabledCustomerEntry([
        { enabled: false, customerEntry: { publicId: 'disabled-entry' } },
      ]),
    ).toBe(false);
    expect(
      hasEnabledCustomerEntry([
        { enabled: false, customerEntry: { publicId: 'disabled-entry' } },
        { enabled: true, customerEntry: null },
      ]),
    ).toBe(false);
    expect(
      hasEnabledCustomerEntry([
        { enabled: true, customerEntry: { publicId: 'enabled-entry' } },
      ]),
    ).toBe(true);
  });
});
