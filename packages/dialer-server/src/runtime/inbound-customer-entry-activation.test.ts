import { describe, expect, it } from 'bun:test';

import { hasEnabledCustomerEntry, hasEnabledCallbacks } from './inbound';

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

it('requires callback dependencies only for enabled callback numbers', () => {
  expect(hasEnabledCallbacks([{ enabled: false, callback: {} }])).toBe(false);
  expect(hasEnabledCallbacks([{ enabled: true, callback: null }])).toBe(false);
  expect(hasEnabledCallbacks([{ enabled: true, callback: {} }])).toBe(true);
});
