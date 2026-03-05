import { extractAreaCode, LocalPresenceService } from './local-presence';
import type { PhoneNumber } from '../types';

describe('extractAreaCode', () => {
  it('should extract area code from E.164 (+1XXXXXXXXXX)', () => {
    expect(extractAreaCode('+14155551234')).toBe('415');
  });

  it('should extract area code from 10-digit number', () => {
    expect(extractAreaCode('4155551234')).toBe('415');
  });

  it('should extract area code from 11-digit with leading 1', () => {
    expect(extractAreaCode('14155551234')).toBe('415');
  });

  it('should return null for short numbers', () => {
    expect(extractAreaCode('12345')).toBeNull();
  });

  it('should strip non-digit characters', () => {
    expect(extractAreaCode('(415) 555-1234')).toBe('415');
  });
});

describe('LocalPresenceService', () => {
  const makeNumber = (areaCode: string, opts?: Partial<PhoneNumber>): PhoneNumber => ({
    phoneNumber: `+1${areaCode}5550000`,
    areaCode,
    isPrimary: false,
    isActive: true,
    ...opts,
  });

  describe('selectNumber', () => {
    it('should return exact area code match', async () => {
      const service = new LocalPresenceService();
      const pool = {
        numbers: [makeNumber('212'), makeNumber('415'), makeNumber('310')],
      };

      const result = await service.selectNumber(pool, '+14155551234');
      expect(result).not.toBeNull();
      expect(result!.areaCode).toBe('415');
      expect(result!.localMatch).toBe(true);
      expect(result!.proximityMatch).toBe(false);
    });

    it('should fall back to proximity match when no exact match', async () => {
      const distanceFn = jest.fn()
        .mockResolvedValueOnce(50)   // 212 → 50mi
        .mockResolvedValueOnce(200); // 310 → 200mi (too far)

      const service = new LocalPresenceService({ distanceFn, maxDistanceMiles: 100 });
      const pool = {
        numbers: [makeNumber('212'), makeNumber('310')],
      };

      const result = await service.selectNumber(pool, '+14155551234');
      expect(result).not.toBeNull();
      expect(result!.areaCode).toBe('212');
      expect(result!.proximityMatch).toBe(true);
      expect(result!.distanceMiles).toBe(50);
    });

    it('should fall back to primary number when no proximity match', async () => {
      const distanceFn = jest.fn().mockResolvedValue(500); // all too far

      const service = new LocalPresenceService({ distanceFn, maxDistanceMiles: 100 });
      const pool = {
        numbers: [makeNumber('212'), makeNumber('310', { isPrimary: true })],
        primaryNumber: makeNumber('310', { isPrimary: true }),
      };

      const result = await service.selectNumber(pool, '+14155551234');
      expect(result).not.toBeNull();
      expect(result!.areaCode).toBe('310');
      expect(result!.isPrimary).toBe(true);
      expect(result!.localMatch).toBe(false);
      expect(result!.proximityMatch).toBe(false);
    });

    it('should return null when pool is empty and no primary', async () => {
      const service = new LocalPresenceService();
      const result = await service.selectNumber({ numbers: [] }, '+14155551234');
      expect(result).toBeNull();
    });

    it('should skip inactive numbers', async () => {
      const service = new LocalPresenceService();
      const pool = {
        numbers: [
          makeNumber('415', { isActive: false }),
          makeNumber('212', { isPrimary: true }),
        ],
      };

      const result = await service.selectNumber(pool, '+14155551234');
      // 415 is inactive, so should fall back to primary 212
      expect(result!.areaCode).toBe('212');
      expect(result!.isPrimary).toBe(true);
    });

    it('should pick closest proximity number', async () => {
      const distanceFn = jest.fn()
        .mockResolvedValueOnce(80)  // 212 → 80mi
        .mockResolvedValueOnce(30); // 718 → 30mi

      const service = new LocalPresenceService({ distanceFn, maxDistanceMiles: 100 });
      const pool = { numbers: [makeNumber('212'), makeNumber('718')] };

      const result = await service.selectNumber(pool, '+14155551234');
      expect(result!.areaCode).toBe('718');
      expect(result!.distanceMiles).toBe(30);
    });

    it('should handle invalid customer number gracefully', async () => {
      const service = new LocalPresenceService();
      const pool = {
        numbers: [makeNumber('415')],
        primaryNumber: makeNumber('415', { isPrimary: true }),
      };

      const result = await service.selectNumber(pool, '123');
      // can't extract area code, falls to primary
      expect(result).not.toBeNull();
      expect(result!.isPrimary).toBe(true);
    });
  });
});
