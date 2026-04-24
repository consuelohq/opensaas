import { normalizePhone, isValidPhone } from './utils';

describe('normalizePhone', () => {
  it('should normalize 10-digit number to E.164', () => {
    expect(normalizePhone('4155551234')).toBe('+14155551234');
  });

  it('should normalize 11-digit number starting with 1', () => {
    expect(normalizePhone('14155551234')).toBe('+14155551234');
  });

  it('should strip non-digit characters', () => {
    expect(normalizePhone('(415) 555-1234')).toBe('+14155551234');
  });

  it('should strip dots and spaces', () => {
    expect(normalizePhone('415.555.1234')).toBe('+14155551234');
  });

  it('should pass through already-normalized E.164', () => {
    expect(normalizePhone('+14155551234')).toBe('+14155551234');
  });

  it('should return empty string for empty input', () => {
    expect(normalizePhone('')).toBe('');
  });

  it('should return empty string for non-digit input', () => {
    expect(normalizePhone('abc')).toBe('');
  });

  it('should handle international numbers with explicit country code', () => {
    expect(normalizePhone('+442071234567')).toBe('+442071234567');
  });

  it('should reject invalid local-looking numbers', () => {
    expect(normalizePhone('12345')).toBe('');
    expect(isValidPhone(normalizePhone('12345'))).toBe(false);
  });

  it('should handle number with leading +1 and 10 digits', () => {
    expect(normalizePhone('+1 (415) 555-1234')).toBe('+14155551234');
  });

  it('should reject ambiguous international-looking numbers without +', () => {
    expect(normalizePhone('44207123456')).toBe('');
    expect(isValidPhone(normalizePhone('44207123456'))).toBe(false);
  });

  it('should handle number with dashes only', () => {
    expect(normalizePhone('415-555-1234')).toBe('+14155551234');
  });
});

describe('isValidPhone', () => {
  it('should validate correct phone numbers', () => {
    expect(isValidPhone('+14155551234')).toBe(true);
    expect(isValidPhone('+442071234567')).toBe(true);
    expect(isValidPhone('8178447395')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });

  it('should reject number without + when it cannot be parsed as a valid US number', () => {
    expect(isValidPhone('14155551234')).toBe(true);
    expect(isValidPhone('44207123456')).toBe(false);
  });

  it('should reject number starting with +0', () => {
    expect(isValidPhone('+04155551234')).toBe(false);
  });

  it('should reject too-short numbers', () => {
    expect(isValidPhone('+12345')).toBe(false);
  });

  it('should reject too-long numbers', () => {
    expect(isValidPhone('+1234567890123456')).toBe(false);
  });

  it('should reject invalid minimum-length E.164-shaped numbers', () => {
    expect(isValidPhone('+1234567')).toBe(false);
  });

  it('should reject invalid maximum-length E.164-shaped numbers', () => {
    expect(isValidPhone('+123456789012345')).toBe(false);
  });

  it('should reject long NANP-shaped numbers that Twilio rejects', () => {
    expect(normalizePhone('584143861603')).toBe('');
    expect(isValidPhone('584143861603')).toBe(false);
    expect(isValidPhone('+1584143861603')).toBe(false);
  });
});
