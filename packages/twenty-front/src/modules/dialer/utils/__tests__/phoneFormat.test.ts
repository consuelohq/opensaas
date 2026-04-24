jest.mock('@consuelo/contacts', () => ({
  isValidPhone: jest.fn((phoneNumber: string) =>
    ['+18178447395', '+14155552671', '+442071234567'].includes(phoneNumber),
  ),
  normalizePhone: jest.fn((phoneNumber: string) => {
    if (phoneNumber === '8178447395') return '+18178447395';
    if (phoneNumber === '(415) 555-2671') return '+14155552671';
    if (phoneNumber === '+442071234567') return '+442071234567';
    return '';
  }),
}));

jest.mock('@consuelo/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

import { toE164 } from '../phoneFormat';

describe('toE164', () => {
  it('should normalize valid US phone numbers', () => {
    expect(toE164('8178447395')).toBe('+18178447395');
    expect(toE164('(415) 555-2671')).toBe('+14155552671');
  });

  it('should keep valid explicit international phone numbers', () => {
    expect(toE164('+442071234567')).toBe('+442071234567');
  });

  it('should reject long NANP-shaped numbers that Twilio rejects', () => {
    expect(toE164('584143861603')).toBeNull();
    expect(toE164('+1584143861603')).toBeNull();
  });
});
