import { Context, Effect } from 'effect';
import type {
  InboundCommit,
  InboundCommitResult,
  InboundKind,
  InboundSnapshot,
  InboundCommandStatus,
  InboundStoredCommand,
} from './contracts.js';

export class InboundPersistenceError extends Error {
  readonly _tag = 'InboundPersistenceError';
}
export type InboundJournalService = {
  readonly commit: (
    input: InboundCommit,
  ) => Effect.Effect<InboundCommitResult, InboundPersistenceError>;
  readonly replay: (
    workspaceId: string,
    kind: InboundKind,
    entityId: string,
  ) => Effect.Effect<InboundSnapshot | null, InboundPersistenceError>;
};
export const InboundJournal = Context.GenericTag<InboundJournalService>(
  '@consuelo/dialer/InboundJournal',
);
export const commitInboundFact = (input: InboundCommit) =>
  Effect.flatMap(InboundJournal, (journal) => journal.commit(input));

export type InboundOutboxService = {
  readonly list: (
    workspaceId: string,
    status: InboundCommandStatus,
    afterCommandId?: string,
  ) => Effect.Effect<readonly InboundStoredCommand[], InboundPersistenceError>;
  readonly transition: (
    workspaceId: string,
    commandId: string,
    expectedVersion: number,
    status: InboundCommandStatus,
    reconciled?: boolean,
  ) => Effect.Effect<InboundStoredCommand, InboundPersistenceError>;
};
export const InboundOutbox = Context.GenericTag<InboundOutboxService>(
  '@consuelo/dialer/InboundOutbox',
);
