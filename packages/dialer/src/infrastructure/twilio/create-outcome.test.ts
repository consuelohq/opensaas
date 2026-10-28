import { expect, it } from 'bun:test';
import { classifyTwilioCreateFailure } from './create-outcome';

it('recognizes rejected requests while keeping timeouts and server failures unknown', () => {
  expect(classifyTwilioCreateFailure({ status: 400, code: 21211 })).toBe('not_created');
  expect(classifyTwilioCreateFailure({ status: 429, code: 20429 })).toBe('not_created');
  for (const cause of [new Error('lost response'), null, { status: 408 },
    { status: 500 }, { status: 504 }, { status: '400' }, { status: 409 }]) {
    expect(classifyTwilioCreateFailure(cause)).toBe('unknown');
  }
});
