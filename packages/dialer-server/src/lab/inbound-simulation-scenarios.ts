import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import {
  capture,
  createSimulationEvidence,
} from './inbound-simulation-evidence';
import { createPostgresInboundJournal } from '../inbound/postgres-journal';
import {
  createLabClock,
  createDeliverySchedule,
  createSimulatedEndpoint,
  createSimulatedCarrier,
} from './inbound-simulator';
import {
  createLabBridgeCommit,
  createLabCommit,
  createLabEvent,
  LAB_INBOUND_TIME,
} from './inbound-simulation-fixtures';
import {
  runLabRace,
  runLabWorker,
  type LabWorkerTrace,
} from './inbound-process-runner';
import type { LabCheckpoint } from './inbound-worker-protocol';

// Resources come exclusively from local-dialer-lab's newly created services.
export const runInboundSimulationScenarios = async (options: {
  pool: Pool;
  redis: Redis;
  databaseUrl: string;
  seed: number;
}) => {
  const { pool, redis, databaseUrl, seed } = options;
  try {
    const journal = createPostgresInboundJournal(pool);
    const { cases, record, proofReplay } = createSimulationEvidence(pool);
    const checkpoints: LabCheckpoint[] = [
      'before_commit',
      'after_commit',
      'after_claim',
      'after_effect',
      'after_outcome',
    ];
    for (const checkpoint of checkpoints) {
      const workspaceId = 'rd2-crash-' + checkpoint.replaceAll('_', '-');
      const carrier = createSimulatedCarrier();
      const commit = createLabBridgeCommit(workspaceId);
      const commandId = workspaceId + '-bridge';
      const workers: LabWorkerTrace[] = [];
      const commitCrash =
        checkpoint === 'before_commit' || checkpoint === 'after_commit';
      if (!commitCrash) await journal.commit(commit);
      workers.push(
        await runLabWorker({
          input: {
            databaseUrl,
            workspaceId,
            action: commitCrash ? 'commit' : 'dispatch',
            commit: commitCrash ? commit : undefined,
            commandId,
          },
          carrier,
          crashAt: checkpoint,
        }),
      );
      const crashed = await capture(pool, workspaceId);
      if (checkpoint === 'before_commit') {
        assert.equal(crashed.events.length, 0);
        assert.equal(crashed.commands.length, 0);
        workers.push(
          await runLabWorker({
            input: { databaseUrl, workspaceId, action: 'commit', commit },
            carrier,
          }),
        );
      } else if (checkpoint === 'after_commit') {
        assert.equal(crashed.commands[0]?.status, 'pending');
        assert.equal((await journal.commit(commit)).duplicate, true);
      } else {
        assert.equal(
          crashed.commands[0]?.status,
          checkpoint === 'after_outcome' ? 'succeeded' : 'dispatched',
        );
      }
      if (commitCrash) {
        workers.push(
          await runLabWorker({
            input: { databaseUrl, workspaceId, action: 'dispatch', commandId },
            carrier,
          }),
        );
      } else {
        workers.push(
          await runLabWorker({
            input: { databaseUrl, workspaceId, action: 'reconcile', commandId },
            carrier,
          }),
        );
      }
      const expectedStatus =
        checkpoint === 'after_claim' ? 'failed' : 'succeeded';
      const final = await capture(pool, workspaceId);
      assert.equal(final.commands[0]?.status, expectedStatus);
      assert.equal(
        carrier.evidence().reduce((total, item) => total + item.effects, 0),
        checkpoint === 'after_claim' ? 0 : 1,
      );
      // The harness proves journal recovery, not RD3's still-unimplemented capacity release policy.
      assert.equal(
        final.entities.find((entity) => entity.identity.kind === 'capacity')
          ?.state,
        'connecting',
      );
      await proofReplay(workspaceId);
      await record(checkpoint, workspaceId, carrier, workers);
    }

    for (const mode of ['lose_response', 'reject'] as const) {
      const workspaceId = 'rd2-' + mode.replaceAll('_', '-');
      const commandId = workspaceId + '-bridge';
      const carrier = createSimulatedCarrier();
      await journal.commit(createLabBridgeCommit(workspaceId));
      const workers = [
        await runLabWorker({
          input: { databaseUrl, workspaceId, action: 'dispatch', commandId },
          carrier,
          mode,
        }),
      ];
      if (mode === 'lose_response') {
        assert.equal(
          (await capture(pool, workspaceId)).commands[0]?.status,
          'unknown',
        );
        carrier.setLookupAvailable(false);
        workers.push(
          await runLabWorker({
            input: { databaseUrl, workspaceId, action: 'reconcile', commandId },
            carrier,
          }),
        );
        assert.equal(
          (await capture(pool, workspaceId)).commands[0]?.status,
          'unknown',
        );
        workers.push(
          await runLabWorker({
            input: { databaseUrl, workspaceId, action: 'dispatch', commandId },
            carrier,
          }),
        );
        assert.equal(workers.at(-1)?.messages.at(-1)?.type, 'result');
        assert.equal(
          carrier.evidence()[0]?.attempts,
          1,
          'Unknown must not redispatch',
        );
        carrier.setLookupAvailable(true);
        workers.push(
          await runLabWorker({
            input: { databaseUrl, workspaceId, action: 'reconcile', commandId },
            carrier,
          }),
        );
      }
      assert.equal(
        (await capture(pool, workspaceId)).commands[0]?.status,
        mode === 'reject' ? 'failed' : 'succeeded',
      );
      assert.equal(carrier.evidence()[0]?.effects, mode === 'reject' ? 0 : 1);
      await proofReplay(workspaceId);
      await record(mode, workspaceId, carrier, workers);
    }

    {
      const workspaceId = 'rd2-duplicate-race';
      const carrier = createSimulatedCarrier();
      const commit = createLabBridgeCommit(workspaceId);
      const workers = await runLabRace(
        [0, 1].map(() => ({
          databaseUrl,
          workspaceId,
          action: 'commit' as const,
          commit,
        })),
        carrier,
      );
      const results = workers
        .flatMap((worker) =>
          worker.messages
            .filter((message) => message.type === 'result')
            .map((message) => message.result),
        )
        .sort();
      assert.deepEqual(results, ['committed', 'duplicate']);
      assert.equal((await capture(pool, workspaceId)).commands.length, 1);
      await record('duplicate-processes', workspaceId, carrier, workers);
    }
    {
      const workspaceId = 'rd2-version-race';
      const carrier = createSimulatedCarrier();
      await journal.commit(
        createLabCommit(workspaceId, [
          createLabEvent(workspaceId, 'created'),
          createLabEvent(workspaceId, 'queued', {
            expectedVersion: 1,
            identity: undefined,
            to: 'queued',
          }),
        ]),
      );
      const workers = await runLabRace(
        ['offering', 'abandoned'].map((to) => ({
          databaseUrl,
          workspaceId,
          action: 'commit' as const,
          commit: createLabCommit(workspaceId, [
            createLabEvent(workspaceId, to, {
              expectedVersion: 2,
              identity: undefined,
              to,
            }),
          ]),
        })),
        carrier,
      );
      const results = workers
        .flatMap((worker) =>
          worker.messages
            .filter((message) => message.type === 'result')
            .map((message) => message.result),
        )
        .sort();
      assert.deepEqual(results, ['committed', 'rejected']);
      assert.equal(
        (await journal.replay(workspaceId, 'request', 'request'))?.version,
        3,
      );
      await record(
        'competing-version-processes',
        workspaceId,
        carrier,
        workers,
      );
    }
    {
      const workspaceId = 'rd2-dispatch-race';
      const carrier = createSimulatedCarrier();
      await journal.commit(createLabBridgeCommit(workspaceId));
      const workers = await runLabRace(
        [0, 1].map(() => ({
          databaseUrl,
          workspaceId,
          action: 'dispatch' as const,
          commandId: workspaceId + '-bridge',
        })),
        carrier,
      );
      assert.equal(carrier.evidence()[0]?.attempts, 1);
      assert.equal(carrier.evidence()[0]?.effects, 1);
      assert.equal(
        (await capture(pool, workspaceId)).commands[0]?.status,
        'succeeded',
      );
      await record(
        'competing-dispatch-processes',
        workspaceId,
        carrier,
        workers,
      );
    }

    {
      const workspaceId = 'rd2-endpoint-expiry';
      const carrier = createSimulatedCarrier();
      const clock = createLabClock(LAB_INBOUND_TIME);
      const browser = createSimulatedEndpoint('browser', clock);
      const phone = createSimulatedEndpoint('phone', clock);
      const initial = createLabBridgeCommit(workspaceId);
      const events = initial.events.filter(
        (event) =>
          event.kind !== 'bridge' &&
          !(event.kind === 'assignment' && event.to !== 'offering') &&
          !(event.kind === 'capacity' && event.to === 'connecting') &&
          !(event.kind === 'request' && event.to === 'bridging'),
      );
      await journal.commit(createLabCommit(workspaceId, events));
      browser.setReachable(false);
      assert.equal(browser.respond('accept').result, 'unreachable');
      clock.advance(12_000);
      const response = phone.respond('accept');
      await assert.rejects(() =>
        journal.commit(
          createLabCommit(workspaceId, [
            createLabEvent(workspaceId, 'late-phone-accept', {
              kind: 'assignment',
              entityId: 'assignment',
              expectedVersion: 1,
              identity: undefined,
              to: 'accepted',
              occurredAt: response.observedAt,
              observedAt: response.observedAt,
            }),
          ]),
        ),
      );
      await journal.commit(
        createLabCommit(workspaceId, [
          createLabEvent(workspaceId, 'offer-expired', {
            kind: 'assignment',
            entityId: 'assignment',
            expectedVersion: 1,
            identity: undefined,
            to: 'expired',
            occurredAt: clock.now(),
            observedAt: clock.now(),
          }),
        ]),
      );
      assert.equal(
        (await journal.replay(workspaceId, 'capacity', 'capacity'))?.state,
        'reserved',
      );
      assert.equal(
        (await journal.replay(workspaceId, 'assignment', 'assignment'))?.state,
        'expired',
      );
      await proofReplay(workspaceId);
      await record('endpoint-delay-offer-expiry', workspaceId, carrier, []);
    }
    {
      const workspaceId = 'rd2-caller-abandoned';
      const carrier = createSimulatedCarrier();
      await journal.commit(createLabBridgeCommit(workspaceId));
      const workers = [
        await runLabWorker({
          input: {
            databaseUrl,
            workspaceId,
            action: 'dispatch',
            commandId: workspaceId + '-bridge',
          },
          carrier,
          crashAt: 'after_effect',
        }),
      ];
      await journal.commit(
        createLabCommit(workspaceId, [
          createLabEvent(workspaceId, 'caller-ended', {
            kind: 'leg',
            entityId: 'caller',
            expectedVersion: 3,
            identity: undefined,
            to: 'ended',
          }),
          createLabEvent(workspaceId, 'request-abandoned', {
            expectedVersion: 4,
            identity: undefined,
            to: 'abandoned',
          }),
          createLabEvent(workspaceId, 'capacity-unknown', {
            kind: 'capacity',
            entityId: 'capacity',
            expectedVersion: 3,
            identity: undefined,
            to: 'unknown',
          }),
        ]),
      );
      await assert.rejects(() =>
        journal.commit(
          createLabCommit(workspaceId, [
            createLabEvent(workspaceId, 'unsafe-release', {
              kind: 'capacity',
              entityId: 'capacity',
              expectedVersion: 4,
              identity: undefined,
              to: 'available',
            }),
          ]),
        ),
      );
      await journal.commit(
        createLabCommit(workspaceId, [
          createLabEvent(workspaceId, 'late-leg-answer', {
            kind: 'leg',
            entityId: 'caller',
            expectedVersion: 4,
            identity: undefined,
            to: 'answered',
          }),
        ]),
      );
      assert.equal(
        (await journal.replay(workspaceId, 'leg', 'caller'))?.state,
        'ended',
      );
      assert.equal(
        (await journal.replay(workspaceId, 'request', 'request'))?.state,
        'abandoned',
      );
      assert.equal(
        (await journal.replay(workspaceId, 'capacity', 'capacity'))?.state,
        'unknown',
      );
      assert.equal(carrier.evidence()[0]?.effects, 1);
      await proofReplay(workspaceId);
      await record(
        'caller-hangup-with-unknown-bridge',
        workspaceId,
        carrier,
        workers,
      );
    }

    const deliveries = async (workspaceId: string) => {
      try {
        const clock = createLabClock(LAB_INBOUND_TIME);
        const schedule = createDeliverySchedule({
          seed,
          facts: ['answered', 'ended', 'answered'],
          copies: [2, 1, 0],
          maxDelayMilliseconds: 50,
        });
        await journal.commit(
          createLabCommit(workspaceId, [
            createLabEvent(workspaceId, 'request-created'),
            createLabEvent(workspaceId, 'leg-created', {
              kind: 'leg',
              entityId: 'caller',
              identity: { kind: 'leg', requestId: 'request', role: 'caller' },
              to: 'ringing',
            }),
          ]),
        );
        const outcomes: {
          index: number;
          copy: number;
          at: number;
          state: string;
          duplicate: boolean;
        }[] = [];
        let elapsed = 0;
        for (const delivery of schedule) {
          clock.advance(delivery.at - elapsed);
          elapsed = delivery.at;
          const current = await journal.replay(workspaceId, 'leg', 'caller');
          const result = await journal.commit(
            createLabCommit(workspaceId, [
              createLabEvent(workspaceId, 'delivery-' + delivery.index, {
                kind: 'leg',
                entityId: 'caller',
                identity: undefined,
                expectedVersion: current!.version,
                to: delivery.fact,
                observedAt: clock.now(),
              }),
            ]),
          );
          outcomes.push({
            index: delivery.index,
            copy: delivery.copy,
            at: delivery.at,
            state: (await journal.replay(workspaceId, 'leg', 'caller'))!.state,
            duplicate: result.duplicate,
          });
        }
        assert.equal(
          (await journal.replay(workspaceId, 'leg', 'caller'))?.state,
          'ended',
        );
        assert.equal((await capture(pool, workspaceId)).commands.length, 0);
        await proofReplay(workspaceId);
        await record(
          'seeded-delivery-' + workspaceId,
          workspaceId,
          createSimulatedCarrier(),
          [],
        );
        return outcomes;
      } catch (cause: unknown) {
        throw new Error('Seeded inbound delivery scenario failed', { cause });
      }
    };
    const first = await deliveries('rd2-seed-first');
    const second = await deliveries('rd2-seed-second');
    assert.deepEqual(
      first,
      second,
      'Seeded observed delivery trace must reproduce',
    );

    const workspaceId = 'rd2-dispatch-race';
    const beforeLoss = await capture(pool, workspaceId);
    const key = 'rd2:ephemeral-presence';
    await redis.set(key, 'available');
    await redis.del(key);
    assert.equal(await redis.get(key), null);
    assert.deepEqual(
      await capture(pool, workspaceId),
      beforeLoss,
      'Lost Redis index cannot erase journal authority',
    );
    await proofReplay(workspaceId);
    return {
      seed,
      scenarioCount: cases.length,
      cases,
      deliveryTrace: first,
      allWorkersExited: cases.every((item) =>
        item.workers.every((worker) => worker.exited),
      ),
      replayWithoutEffects: true,
      redisLossPreservedState: true,
      deterministicReplay: true,
      evidenceLevel:
        'simulated-provider-real-postgres-redis-and-worker-processes',
    };
  } catch (cause: unknown) {
    throw new Error('Isolated inbound simulation failed', { cause });
  }
};
