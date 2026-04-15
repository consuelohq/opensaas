import { Dialer } from './dialer';
import { LocalPresenceService } from './services/local-presence';
import type { PhoneNumber } from './types';

describe('Dialer.resolveCallerId', () => {
  const makeNumber = (areaCode: string, overrides?: Partial<PhoneNumber>) => ({
    phoneNumber: `+1${areaCode}5550000`,
    areaCode,
    isPrimary: false,
    isActive: true,
    ...overrides,
  });

  it('should return the manual caller id when one is provided', async () => {
    const dialer = new Dialer();

    const result = await dialer.resolveCallerId({
      to: '+14155551234',
      from: '+15559876543',
      callerIdNumber: '+15551234567',
      localPresence: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        callerIdNumber: '+15551234567',
        selectionMethod: 'manual',
      }),
    );
  });

  it('should return an exact local match when the shared service finds one', async () => {
    const dialer = new Dialer().withLocalPresence(new LocalPresenceService());
    const numberPool = {
      numbers: [makeNumber('212'), makeNumber('415'), makeNumber('310')],
      primaryNumber: makeNumber('310', { isPrimary: true }),
    };

    const result = await dialer.resolveCallerId(
      {
        to: '+14155551234',
        from: '+15559876543',
        localPresence: true,
      },
      numberPool,
    );

    expect(result).toEqual(
      expect.objectContaining({
        callerIdNumber: '+14155550000',
        selectionMethod: 'local_presence',
        localMatch: true,
        proximityMatch: false,
      }),
    );
  });

  it('should return a proximity match when the configured service supports it', async () => {
    const dialer = new Dialer().withLocalPresence(
      new LocalPresenceService({
        maxDistanceMiles: 100,
        distanceFn: async (customerAreaCode, candidateAreaCode) => {
          if (customerAreaCode === '415' && candidateAreaCode === '212') {
            return 50;
          }

          if (customerAreaCode === '415' && candidateAreaCode === '310') {
            return 200;
          }

          return null;
        },
      }),
    );
    const numberPool = {
      numbers: [makeNumber('212'), makeNumber('310')],
      primaryNumber: makeNumber('310', { isPrimary: true }),
    };

    const result = await dialer.resolveCallerId(
      {
        to: '+14155551234',
        from: '+15559876543',
        localPresence: true,
      },
      numberPool,
    );

    expect(result).toEqual(
      expect.objectContaining({
        callerIdNumber: '+12125550000',
        selectionMethod: 'local_presence',
        localMatch: false,
        proximityMatch: true,
        distanceMiles: 50,
      }),
    );
  });

  it('should fall back to the primary number when no match exists', async () => {
    const dialer = new Dialer().withLocalPresence(new LocalPresenceService());
    const numberPool = {
      numbers: [makeNumber('212'), makeNumber('310', { isPrimary: true })],
      primaryNumber: makeNumber('310', { isPrimary: true }),
    };

    const result = await dialer.resolveCallerId(
      {
        to: '+14155551234',
        from: '+15559876543',
        localPresence: true,
      },
      numberPool,
    );

    expect(result).toEqual(
      expect.objectContaining({
        callerIdNumber: '+13105550000',
        selectionMethod: 'primary_fallback',
        isPrimary: true,
      }),
    );
  });

  it('should fall back to the dialer default number when no pool caller id resolves', async () => {
    const dialer = new Dialer({ defaultNumber: '+15550001111' });

    const result = await dialer.resolveCallerId({
      to: '+14155551234',
      from: '+15559876543',
      localPresence: false,
    });

    expect(result).toEqual(
      expect.objectContaining({
        callerIdNumber: '+15550001111',
        selectionMethod: 'primary',
      }),
    );
  });
});
