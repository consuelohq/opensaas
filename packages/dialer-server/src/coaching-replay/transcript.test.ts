import { describe, expect, it } from 'bun:test';
import { createTimeline, reduceTimeline } from '@consuelo/conversation';
import {
  fixtureScope,
  fixtureParticipants,
  segment,
  lifecycle,
  gap,
} from './transcript';

describe('synthetic temporal replay input', () => {
  it('drives the actual production timeline through duplicate, revision, gap, reconnect, foreign and terminal fences', () => {
    const scope = fixtureScope(1);
    let state = createTimeline(scope, fixtureParticipants);
    const initial = segment(scope, 1, 0, {
      finality: 'interim',
      text: 'existing',
    });
    let result = reduceTimeline(state, initial);
    expect(result.status).toBe('applied');
    state = result.state;
    expect(reduceTimeline(state, initial).status).toBe('duplicate');
    const final = segment(scope, 2, 0, {
      revision: 2,
      finality: 'final',
      text: 'existing coverage',
    });
    result = reduceTimeline(state, final);
    expect(result.status).toBe('applied');
    state = result.state;
    expect(reduceTimeline(state, segment(scope, 4, 0)).status).toBe('rejected');
    expect(
      reduceTimeline(state, segment(scope, 3, 0, { revision: 3 })).status,
    ).toBe('rejected');
    result = reduceTimeline(state, gap(scope, 3, 0));
    expect(result.status).toBe('applied');
    result = reduceTimeline(
      result.state,
      lifecycle(scope, 4, 1, 'reconnected'),
    );
    expect(result.status).toBe('applied');
    state = result.state;
    expect(reduceTimeline(state, segment(fixtureScope(2), 5, 1)).status).toBe(
      'rejected',
    );
    result = reduceTimeline(state, lifecycle(scope, 5, 1, 'ended'));
    expect(result.status).toBe('applied');
    expect(reduceTimeline(result.state, segment(scope, 6, 1)).status).toBe(
      'rejected',
    );
    result = reduceTimeline(result.state, lifecycle(scope, 6, 1, 'deleted'));
    expect(result.status).toBe('applied');
    expect(result.state.events).toHaveLength(0);
    expect(Object.keys(result.state.segments)).toHaveLength(0);
  });

  it('preserves unknown role instead of fabricating customer provenance', () => {
    const scope = fixtureScope(2);
    const event = segment(scope, 1, 0, { role: 'unknown' });
    const result = reduceTimeline(
      createTimeline(scope, fixtureParticipants),
      event,
    );
    expect(result.status).toBe('applied');
    expect(result.state.segments.segment?.speaker).toMatchObject({
      role: 'unknown',
      provenance: 'unknown',
    });
  });
});
