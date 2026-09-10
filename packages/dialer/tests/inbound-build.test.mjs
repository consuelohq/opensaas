import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyInboundEvent, InboundJournal, InboundOutbox } from '../dist/inbound/index.js';

test('compiled inbound SDK loads in Node without a TypeScript resolver', () => {
  const time = '2026-09-10T00:00:00.000Z';
  const result = applyInboundEvent(null, {
    schemaVersion: 1, eventId: 'created', workspaceId: 'workspace',
    entityId: 'request', kind: 'request', expectedVersion: 0,
    occurredAt: time, observedAt: time, to: 'created', evidence: 'none',
    identity: { kind: 'request', queueId: 'queue', enteredAt: time },
  });
  assert.equal(result.snapshot.state, 'created');
  assert.equal(result.snapshot.version, 1);
  assert.ok(InboundJournal);
  assert.ok(InboundOutbox);
});
