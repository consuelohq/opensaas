import type { ParallelGroup } from '../types';
import {
  classifyLearningObservation,
  resolveLocalCalendarSlot,
} from './learning-observation';

const group = (overrides: Partial<ParallelGroup> = {}): ParallelGroup => ({
  groupId: 'group-1',
  conferenceName: 'conference-1',
  status: 'completed',
  winnerSid: 'winner',
  calls: [],
  workspaceId: 'workspace-1',
  queueId: 'queue-1',
  userId: 'user-1',
  createdAt: '2026-08-15T12:00:00.000Z',
  profile: {
    id: 'balanced',
    fanout: 3,
    staggerMs: 500,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
  resolverReason: 'test',
  cleanupFailures: [],
  ...overrides,
});

const call = (
  overrides: Partial<ParallelGroup['calls'][number]> = {},
): ParallelGroup['calls'][number] => ({
  callSid: 'loser',
  customerNumber: '+15550000001',
  fromNumber: '+15550000002',
  position: 2,
  status: 'completed',
  contactId: 'contact-1',
  dialStartedAt: '2026-08-15T12:00:00.000Z',
  ...overrides,
});

describe('classifyLearningObservation', () => {
  it('records a configured human-like response even when that leg loses the atomic winner race', () => {
    expect(
      classifyLearningObservation(
        group(),
        call({
          answeredAt: '2026-08-15T12:00:05.000Z',
          amdResult: 'human',
        }),
      ),
    ).toEqual({ outcomeClass: 'response', censorReason: null });
  });

  it('treats a winner-take-all termination without response evidence as censored', () => {
    expect(
      classifyLearningObservation(
        group({ connectedAt: '2026-08-15T12:00:05.000Z' }),
        call({
          status: 'canceled',
          terminatedAt: '2026-08-15T12:00:06.000Z',
        }),
      ),
    ).toEqual({
      outcomeClass: 'censored',
      censorReason: 'competing_winner',
    });
  });

  it('does not invent a competing-winner reason without temporal evidence', () => {
    expect(
      classifyLearningObservation(group(), call({ status: 'canceled' })),
    ).toEqual({
      outcomeClass: 'censored',
      censorReason: 'ambiguous_termination',
    });
  });

  it('treats explicit machine and carrier non-response outcomes as observed failures', () => {
    expect(
      classifyLearningObservation(group(), call({ amdResult: 'machine' })),
    ).toEqual({ outcomeClass: 'non_response', censorReason: null });
    expect(
      classifyLearningObservation(
        group({ winnerSid: null }),
        call({ status: 'no-answer', amdResult: 'unknown' }),
      ),
    ).toEqual({ outcomeClass: 'non_response', censorReason: null });
    expect(
      classifyLearningObservation(group({ winnerSid: null }), call({ status: 'busy' })),
    ).toEqual({ outcomeClass: 'non_response', censorReason: null });
  });

  it('keeps ambiguous completion or cancellation out of the Bernoulli denominator', () => {
    expect(
      classifyLearningObservation(
        group({ winnerSid: null }),
        call({ status: 'completed' }),
      ),
    ).toEqual({
      outcomeClass: 'censored',
      censorReason: 'ambiguous_termination',
    });
    expect(
      classifyLearningObservation(
        group({ winnerSid: null }),
        call({ status: 'canceled' }),
      ),
    ).toEqual({
      outcomeClass: 'censored',
      censorReason: 'ambiguous_termination',
    });
  });
});

describe('resolveLocalCalendarSlot', () => {
  it('captures the historical local bin across the repeated DST fall-back hour', () => {
    expect(
      resolveLocalCalendarSlot(
        '2026-11-01T05:30:00.000Z',
        'America/New_York',
      ),
    ).toEqual({ hourOfDay: 1, dayOfWeek: 0 });
    expect(
      resolveLocalCalendarSlot(
        '2026-11-01T06:30:00.000Z',
        'America/New_York',
      ),
    ).toEqual({ hourOfDay: 1, dayOfWeek: 0 });
  });

  it('rejects invalid event times and IANA time zones', () => {
    expect(() => resolveLocalCalendarSlot('not-a-date', 'UTC')).toThrow();
    expect(() =>
      resolveLocalCalendarSlot('2026-08-15T12:00:00.000Z', 'Not/AZone'),
    ).toThrow();
  });
});
