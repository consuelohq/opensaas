export type PostCallAnalysisOutcome =
  | 'interested'
  | 'not_interested'
  | 'callback_scheduled'
  | 'voicemail'
  | 'no_answer'
  | 'wrong_number'
  | 'other';

export type CallDisposition =
  | 'connected'
  | 'not-interested'
  | 'follow-up'
  | 'voicemail'
  | 'no-answer'
  | 'wrong-number'
  | 'busy'
  | 'other';

export type ListMemberDisposition =
  | 'ANSWERED'
  | 'VOICEMAIL'
  | 'BUSY'
  | 'NO_ANSWER';

export type PersistedCallAnalyticsLike = {
  outcome: PostCallAnalysisOutcome;
  summary?: string;
  [key: string]: unknown;
};

type QueryResult = {
  rows: Array<Record<string, unknown>>;
  rowCount?: number | null;
};

export type QueryablePool = {
  query: (sql: string, params: unknown[]) => Promise<QueryResult>;
};

export type PersistPostCallAnalysisInput = {
  callId: string;
  workspaceId: string;
  analysis: PersistedCallAnalyticsLike;
};

export type PersistPostCallAnalysisResult = {
  committedDisposition: CallDisposition | null;
  requiresManualDisposition: boolean;
};

const SQL_PERSIST_ANALYSIS_AND_DISPOSITION =
  'UPDATE calls SET analysis = $1, outcome = $2, updated_at = NOW() WHERE (id::text = $3 OR call_sid = $3) AND workspace_id = $4 RETURNING id, outcome';

const SQL_PERSIST_ANALYSIS_ONLY =
  'UPDATE calls SET analysis = $1, updated_at = NOW() WHERE (id::text = $2 OR call_sid = $2) AND workspace_id = $3 RETURNING id, outcome';

export const mapPostCallOutcomeToCallDisposition = (
  outcome: PostCallAnalysisOutcome,
): CallDisposition | null => {
  switch (outcome) {
    case 'interested':
      return 'connected';
    case 'not_interested':
      return 'not-interested';
    case 'callback_scheduled':
      return 'follow-up';
    case 'voicemail':
      return 'voicemail';
    case 'no_answer':
      return 'no-answer';
    case 'wrong_number':
      return 'wrong-number';
    case 'other':
      return null;
  }
};

export const mapCallDispositionToListMemberDisposition = (
  disposition: CallDisposition,
): ListMemberDisposition => {
  switch (disposition) {
    case 'voicemail':
      return 'VOICEMAIL';
    case 'busy':
      return 'BUSY';
    case 'no-answer':
      return 'NO_ANSWER';
    case 'connected':
    case 'not-interested':
    case 'follow-up':
    case 'wrong-number':
    case 'other':
      return 'ANSWERED';
  }
};

export const persistPostCallAnalysisWithDisposition = async (
  pool: QueryablePool,
  input: PersistPostCallAnalysisInput,
): Promise<PersistPostCallAnalysisResult> => {
  try {
    const committedDisposition = mapPostCallOutcomeToCallDisposition(
      input.analysis.outcome,
    );

    const result = await pool.query(
      committedDisposition === null
        ? SQL_PERSIST_ANALYSIS_ONLY
        : SQL_PERSIST_ANALYSIS_AND_DISPOSITION,
      committedDisposition === null
        ? [JSON.stringify(input.analysis), input.callId, input.workspaceId]
        : [
            JSON.stringify(input.analysis),
            committedDisposition,
            input.callId,
            input.workspaceId,
          ],
    );

    if (result.rows.length === 0 || result.rowCount === 0) {
      throw new Error('Call not found');
    }

    return {
      committedDisposition,
      requiresManualDisposition: committedDisposition === null,
    };
  } catch (error: unknown) {
    throw error;
  }
};
