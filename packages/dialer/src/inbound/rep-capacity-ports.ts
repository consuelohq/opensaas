import { Context, Effect } from 'effect';
import { InboundPersistenceError } from './ports.js';
import type {
  RepCapacityInput,
  RepCapacityState,
} from './rep-capacity-contracts.js';

export type RepCapacityResult = {
  readonly duplicate: boolean;
  readonly state: RepCapacityState;
};
export type RepCapacityQuery = {
  readonly workspaceId: string;
  readonly afterCapacityId?: string;
  readonly ownedOnly?: boolean;
  readonly limit: number;
};
export type RepCapacityService = {
  readonly list: (
    query: RepCapacityQuery,
  ) => Effect.Effect<readonly RepCapacityState[], InboundPersistenceError>;
  readonly execute: (
    input: RepCapacityInput,
  ) => Effect.Effect<RepCapacityResult, InboundPersistenceError>;
  readonly read: (
    workspaceId: string,
    capacityId: string,
  ) => Effect.Effect<RepCapacityState | null, InboundPersistenceError>;
  readonly replay: (
    workspaceId: string,
    capacityId: string,
  ) => Effect.Effect<RepCapacityState | null, InboundPersistenceError>;
};
export const RepCapacity = Context.GenericTag<RepCapacityService>(
  '@consuelo/dialer/RepCapacity',
);
export const executeRepCapacityAction = (input: RepCapacityInput) =>
  Effect.flatMap(RepCapacity, (service) => service.execute(input));
