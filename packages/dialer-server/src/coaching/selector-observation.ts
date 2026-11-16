/** Numeric, text-free backend evidence. Times include validation; they are not ASR or DOM latency. */
export const SELECTOR_OUTCOMES = [
  'pending',
  'applied',
  'unchanged',
  'abstained',
  'expired',
  'superseded',
  'invalid-selection',
  'context-rejected',
  'evidence-rejected',
  'dwell',
  'rule-priority',
  'reducer-rejected',
  'cancelled',
  'provider-failure',
] as const;
export type SelectorObservation = {
  request: number;
  queueMs: number;
  requestMs: number | null;
  decisionMs: number | null;
  cueAgeMs: number | null;
  outcome: (typeof SELECTOR_OUTCOMES)[number];
  cardIndex: number | null;
  evidenceTurnIndices: number[];
};
