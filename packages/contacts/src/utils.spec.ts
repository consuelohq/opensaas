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

  it('should handle international numbers (non-US)', () => {
    expect(normalizePhone('+442071234567')).toBe('+442071234567');
  });

  it('should handle short numbers by prepending +', () => {
    expect(normalizePhone('12345')).toBe('+12345');
  });

  it('should handle number with leading +1 and 10 digits', () => {
    expect(normalizePhone('+1 (415) 555-1234')).toBe('+14155551234');
  });

  it('should handle 11-digit non-US number', () => {
    // 11 digits starting with 4 (not 1) — treated as international
    expect(normalizePhone('44207123456')).toBe('+44207123456');
  });

  it('should handle number with dashes only', () => {
    expect(normalizePhone('415-555-1234')).toBe('+14155551234');
  });
});

describe('isValidPhone', () => {
  it('should validate correct E.164 numbers', () => {
    expect(isValidPhone('+14155551234')).toBe(true);
    expect(isValidPhone('+442071234567')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });

  it('should reject number without +', () => {
    expect(isValidPhone('14155551234')).toBe(false);
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

  it('should accept minimum valid length (7 digits)', () => {
    expect(isValidPhone('+1234567')).toBe(true);
  });

  it('should accept maximum valid length (15 digits)', () => {
    expect(isValidPhone('+123456789012345')).toBe(true);
  });
});
