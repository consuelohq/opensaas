// test: post-call analysis disposition commit contract
// run: yarn tsx packages/api/src/services/__tests__/post-call-disposition.test.ts

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  mapCallDispositionToListMemberDisposition,
  mapPostCallOutcomeToCallDisposition,
  persistPostCallAnalysisWithDisposition,
  type PersistedCallAnalyticsLike,
} from '../post-call-disposition.js';

const baseAnalysis = (
  outcome: PersistedCallAnalyticsLike['outcome'],
): PersistedCallAnalyticsLike => ({
  outcome,
  summary: 'Prospect requested a follow-up call.',
});

describe('post-call disposition mapping', () => {
  it('normalizes Pi post-call outcomes into committed call dispositions', () => {
    assert.equal(
      mapPostCallOutcomeToCallDisposition('interested'),
      'connected',
    );
    assert.equal(
      mapPostCallOutcomeToCallDisposition('not_interested'),
      'not-interested',
    );
    assert.equal(
      mapPostCallOutcomeToCallDisposition('callback_scheduled'),
      'follow-up',
    );
    assert.equal(mapPostCallOutcomeToCallDisposition('voicemail'), 'voicemail');
    assert.equal(mapPostCallOutcomeToCallDisposition('no_answer'), 'no-answer');
    assert.equal(
      mapPostCallOutcomeToCallDisposition('wrong_number'),
      'wrong-number',
    );
  });

  it('does not auto-commit ambiguous other outcomes', () => {
    assert.equal(mapPostCallOutcomeToCallDisposition('other'), null);
  });

  it('maps committed call dispositions into list-member dispositions', () => {
    assert.equal(
      mapCallDispositionToListMemberDisposition('connected'),
      'ANSWERED',
    );
    assert.equal(
      mapCallDispositionToListMemberDisposition('follow-up'),
      'ANSWERED',
    );
    assert.equal(
      mapCallDispositionToListMemberDisposition('not-interested'),
      'ANSWERED',
    );
    assert.equal(
      mapCallDispositionToListMemberDisposition('wrong-number'),
      'ANSWERED',
    );
    assert.equal(
      mapCallDispositionToListMemberDisposition('voicemail'),
      'VOICEMAIL',
    );
    assert.equal(mapCallDispositionToListMemberDisposition('busy'), 'BUSY');
    assert.equal(
      mapCallDispositionToListMemberDisposition('no-answer'),
      'NO_ANSWER',
    );
  });
});

describe('persistPostCallAnalysisWithDisposition', () => {
  it('persists analysis and commits a canonical disposition when Pi returns a deterministic outcome', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [{ id: 'call-1', outcome: params[1] }], rowCount: 1 };
      },
    };

    const result = await persistPostCallAnalysisWithDisposition(pool, {
      callId: 'call-1',
      workspaceId: 'ws-1',
      analysis: baseAnalysis('callback_scheduled'),
    });

    assert.equal(result.committedDisposition, 'follow-up');
    assert.equal(result.requiresManualDisposition, false);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /analysis = \$1/);
    assert.match(queries[0].sql, /outcome = \$2/);
    assert.deepEqual(queries[0].params.slice(1), [
      'follow-up',
      'call-1',
      'ws-1',
    ]);
  });

  it('persists analysis without overwriting outcome when Pi returns an ambiguous other outcome', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [{ id: 'call-1', outcome: null }], rowCount: 1 };
      },
    };

    const result = await persistPostCallAnalysisWithDisposition(pool, {
      callId: 'call-1',
      workspaceId: 'ws-1',
      analysis: baseAnalysis('other'),
    });

    assert.equal(result.committedDisposition, null);
    assert.equal(result.requiresManualDisposition, true);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /analysis = \$1/);
    assert.doesNotMatch(queries[0].sql, /outcome = \$2/);
    assert.deepEqual(queries[0].params.slice(1), ['call-1', 'ws-1']);
  });
});
