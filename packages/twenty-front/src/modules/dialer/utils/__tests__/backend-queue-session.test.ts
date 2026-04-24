import { getBackendQueueSessionEndpoint } from '@/dialer/utils/backend-queue-session';

describe('getBackendQueueSessionEndpoint', () => {
  it('should not restart an already active backend queue', () => {
    expect(getBackendQueueSessionEndpoint('active')).toBeNull();
  });

  it('should resume a paused backend queue', () => {
    expect(getBackendQueueSessionEndpoint('paused')).toBe('resume');
  });

  it('should start an idle backend queue', () => {
    expect(getBackendQueueSessionEndpoint('idle')).toBe('start');
  });

  it('should not restart a completed backend queue', () => {
    expect(getBackendQueueSessionEndpoint('completed')).toBeNull();
  });
});
