import { toE164 } from '@/dialer/utils/phoneFormat';

describe('toE164', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
