import { getParallelDialerEndpoint } from '@/dialer/utils/parallel-dialer-endpoint';

describe('getParallelDialerEndpoint', () => {
  it('should target the Nest consuelo-api parallel namespace', () => {
    expect(getParallelDialerEndpoint('https://app.consuelohq.com')).toBe(
      'https://app.consuelohq.com/api/v1/calls/parallel',
    );
  });

  it('should append group paths without dropping the api namespace', () => {
    expect(
      getParallelDialerEndpoint('https://app.consuelohq.com/', 'group-1'),
    ).toBe('https://app.consuelohq.com/api/v1/calls/parallel/group-1');
  });
});
