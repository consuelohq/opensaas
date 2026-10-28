import { AsyncLocalStorage } from 'node:async_hooks';

export type TraceRoutingContext = {
  requestedNodeId?: string;
  resolvedNodeId?: string;
  resolvedNodeName?: string;
  defaultNodeId?: string;
  routeSource?: string;
};

const traceRoutingStorage = new AsyncLocalStorage<TraceRoutingContext>();

export function withTraceRoutingContext<T>(
  routing: TraceRoutingContext | undefined,
  operation: () => T,
): T {
  if (!routing) return operation();
  return traceRoutingStorage.run(routing, operation);
}

export function currentTraceRoutingContext(): TraceRoutingContext | undefined {
  return traceRoutingStorage.getStore();
}
