import {
  getBackendQueueContactId,
  getBackendQueueSessionEndpoint,
  isBackendQueueContactIdMatch,
} from '@/dialer/utils/backend-queue-session';

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

describe('backend queue contact id helpers', () => {
  it('uses the person id when a list member has one', () => {
    expect(
      getBackendQueueContactId({
        id: 'list-member-id',
        personId: 'person-id',
      }),
    ).toBe('person-id');
  });

  it('falls back to the record id when a person id is missing', () => {
    expect(getBackendQueueContactId({ id: 'record-id', personId: null })).toBe(
      'record-id',
    );
  });

  it('matches backend queue items by the same contact id sent during queue creation', () => {
    expect(
      isBackendQueueContactIdMatch(
        { id: 'list-member-id', personId: 'person-id' },
        'person-id',
      ),
    ).toBe(true);
    expect(
      isBackendQueueContactIdMatch(
        { id: 'list-member-id', personId: 'person-id' },
        'list-member-id',
      ),
    ).toBe(false);
  });
});
