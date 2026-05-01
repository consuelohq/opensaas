import type { PhoneNumber } from '@consuelo/dialer';

const mockQuery = jest.fn();
const mockGetNumberPackStatus = jest.fn();
const mockGetPhoneNumberAddOnStatus = jest.fn();

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

jest.mock('../shared/db.js', () => ({
  getSharedPool: jest.fn().mockResolvedValue({
    query: (...args: unknown[]) => mockQuery(...args),
  }),
}));

jest.mock('./number-packs.js', () => ({
  getNumberPackStatus: (...args: unknown[]) => mockGetNumberPackStatus(...args),
}));

jest.mock('./phone-number-addons.js', () => ({
  getPhoneNumberAddOnStatus: (...args: unknown[]) =>
    mockGetPhoneNumberAddOnStatus(...args),
}));

import * as Sentry from '@sentry/node';

import { listWorkspacePhoneNumbers } from './workspace-phone-numbers';

const createDialerNumber = (
  overrides: Partial<PhoneNumber> = {},
): PhoneNumber => ({
  areaCode: '555',
  friendlyName: 'Main',
  isActive: true,
  isPrimary: false,
  phoneNumber: '+15551234567',
  twilioSid: 'PN-001',
  ...overrides,
});

describe('listWorkspacePhoneNumbers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LEGACY_PHONE_NUMBER_WORKSPACE_ID = 'ws-legacy';
    mockGetNumberPackStatus.mockResolvedValue({ totalPackSlots: 0 });
    mockGetPhoneNumberAddOnStatus.mockResolvedValue({ totalActiveQuantity: 0 });
  });

  it('backfills untracked twilio numbers for non-legacy workspaces before filtering', async () => {
    const dialerNumbers: PhoneNumber[] = [createDialerNumber()];

    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            workspace_id: 'ws-test-001',
            phone_number: '+15551234567',
            friendly_name: 'Main',
            area_code: '555',
            twilio_sid: 'PN-001',
            ownership_type: 'included',
            status: 'active',
          },
        ],
      });

    const result = await listWorkspacePhoneNumbers(
      'ws-test-001',
      dialerNumbers,
      null,
    );

    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT twilio_sid FROM workspace_phone_numbers'),
      [['PN-001']],
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO workspace_phone_numbers'),
      ['ws-test-001', '+15551234567', 'Main', '555', 'PN-001', 'included'],
    );
    expect(result).toEqual([
      expect.objectContaining({
        ownershipType: 'included',
        phoneNumber: '+15551234567',
        twilioSid: 'PN-001',
        workspaceId: 'ws-test-001',
      }),
    ]);
  });
  it('does not report missing workspace phone-number table before route fallback', async () => {
    const dialerNumbers: PhoneNumber[] = [createDialerNumber()];
    const missingRelationError = new Error(
      'ERROR: Relation "public.workspace_phone_numbers" does not exist',
    );

    mockQuery.mockRejectedValueOnce(missingRelationError);

    await expect(
      listWorkspacePhoneNumbers('ws-test-001', dialerNumbers, null),
    ).rejects.toThrow(missingRelationError);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
