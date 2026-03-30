import { createState } from '@/ui/utilities/state/utils/createState';

export type CallErrorReason =
  | 'failed'
  | 'busy'
  | 'no-answer'
  | 'canceled'
  | 'unknown'
  | 'caller_id_locked'
  | 'no_caller_id';

export interface CallError {
  reason: CallErrorReason;
  message: string;
  occurredAt: Date;
}

export const callErrorState = createState<CallError | null>({
  key: 'dialerCallErrorState',
  defaultValue: null,
});
