import { describe, expect, it } from 'bun:test';
import { readWorkspaceLaunch } from './workspace-launch';
describe('persistent workspace launch intent', () => {
  it('keeps fenced acceptance and explicit readiness data, without credentials', () => {
    expect(
      readWorkspaceLaunch({
        id: 'once',
        mode: 'inbound',
        action: 'inbound-accept',
        assignmentId: 'a',
        generation: 17,
        endpointId: 'phone',
        token: 'must-not-forward',
      }),
    ).toEqual({
      id: 'once',
      mode: 'inbound',
      action: 'inbound-accept',
      assignmentId: 'a',
      generation: 17,
      endpointId: 'phone',
    });
    expect(
      readWorkspaceLaunch({
        id: 'once',
        mode: 'inbound',
        action: 'inbound-readiness',
        ready: true,
        endpoints: [{ endpointId: 'phone', kind: 'phone' }],
      })?.ready,
    ).toBe(true);
  });
  it('rejects malformed generations, modes and oversized device data', () => {
    for (const generation of [-1, 1.5, '17'])
      expect(
        readWorkspaceLaunch({
          id: 'x',
          mode: 'inbound',
          action: 'inbound-accept',
          assignmentId: 'a',
          generation,
          endpointId: 'phone',
        }),
      ).toBeNull();
    expect(
      readWorkspaceLaunch({ id: 'x', mode: 'customer', action: 'open' }),
    ).toBeNull();
    expect(
      readWorkspaceLaunch({
        id: 'x',
        mode: 'inbound',
        action: 'inbound-readiness',
        ready: true,
        endpoints: Array(11).fill({ endpointId: 'x', kind: 'phone' }),
      }),
    ).toBeNull();
  });
});
