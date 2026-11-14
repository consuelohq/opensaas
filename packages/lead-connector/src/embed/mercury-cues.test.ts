import { describe, expect, it } from 'bun:test';
import { createMercuryCueSession, type MercuryCueView } from './mercury-cues';

const cue = (scopeKey = 'call-a', revision = 1): MercuryCueView => ({
  scopeKey,
  revision,
  heading: 'Family priorities',
  status: 'live',
  kind: 'approved',
  points: [
    {
      slotId: 'one',
      text: 'Ask who depends on them',
      exact: 'Who depends on your income?',
      source: 'Life insurance playbook · v1',
    },
  ],
});
describe('call-scoped Mercury subscription', () => {
  it('fences late events across call identity and disposal', () => {
    const updates: Array<MercuryCueView | null> = [];
    const session = createMercuryCueSession((v) => updates.push(v));
    let deliver = (_v: MercuryCueView) => {};
    let stopped = 0;
    session.connect('call-a', (_scope, receive) => {
      deliver = receive;
      return () => {
        stopped++;
      };
    });
    const late = deliver;
    deliver(cue());
    expect(session.current()?.revision).toBe(1);
    deliver(cue('call-a', 0));
    expect(session.current()?.revision).toBe(1);
    session.connect('call-b', (_scope, receive) => {
      deliver = receive;
      return () => {
        stopped++;
      };
    });
    late(cue('call-a', 9));
    deliver(cue('call-a', 10));
    expect(session.current()).toBeNull();
    deliver(cue('call-b'));
    expect(session.current()?.scopeKey).toBe('call-b');
    session.dispose();
    deliver(cue('call-b', 2));
    expect(session.current()).toBeNull();
    expect(stopped).toBe(2);
  });
  it('holds pinned/manual text while retaining the newest automatic card', () => {
    const session = createMercuryCueSession(() => {});
    let deliver = (_v: MercuryCueView) => {};
    session.connect('call-a', (_scope, receive) => {
      deliver = receive;
      return () => {};
    });
    deliver(cue());
    session.setPinned(true);
    deliver({ ...cue('call-a', 2), heading: 'Affordability' });
    expect(session.current()?.heading).toBe('Family priorities');
    session.returnToAuto();
    expect(session.current()?.heading).toBe('Affordability');
    session.setManual({ ...cue('call-a', 3), heading: 'Manual choice' });
    deliver({ ...cue('call-a', 4), heading: 'Latest automatic' });
    expect(session.current()?.heading).toBe('Manual choice');
    session.returnToAuto();
    expect(session.current()?.heading).toBe('Latest automatic');
  });
});
