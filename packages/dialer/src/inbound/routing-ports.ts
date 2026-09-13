import { Context, Effect } from 'effect';
import { InboundPersistenceError } from './ports.js';
import type { InboundRoutingEvaluation } from './routing-contracts.js';
export type RoutingTickInput = {
  readonly workspaceId: string;
  readonly queueId: string;
  readonly decisionId: string;
};
export type RoutingTickResult = {
  readonly workspaceId: string;
  readonly queueId: string;
  readonly decisionId: string;
  readonly duplicate: boolean;
  readonly evaluation: InboundRoutingEvaluation;
  readonly reservation: null | {
    readonly capacityId: string;
    readonly capacityVersion: number;
    readonly assignmentId: string;
    readonly generation: number;
  };
};
export const InboundRouting = Context.GenericTag<{
  readonly tick: (
    input: RoutingTickInput,
  ) => Effect.Effect<RoutingTickResult, InboundPersistenceError>;
}>('@consuelo/dialer/InboundRouting');
export const routeInboundQueue = (input: RoutingTickInput) =>
  Effect.flatMap(InboundRouting, (service) => service.tick(input));
