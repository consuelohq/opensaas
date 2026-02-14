import { createState } from '@/ui/utilities/state/utils/createState';
import { type TalkingPoints, type TranscriptEntry } from '@/dialer/types/coaching';

export const coachingLoadingState = createState<boolean>({
  key: 'coachingLoadingState',
  defaultValue: false,
});

export const talkingPointsState = createState<TalkingPoints | null>({
  key: 'talkingPointsState',
  defaultValue: null,
});

export const coachingErrorState = createState<string | null>({
  key: 'coachingErrorState',
  defaultValue: null,
});

export const transcriptState = createState<TranscriptEntry[]>({
  key: 'transcriptState',
  defaultValue: [],
});

export const transcriptConnectedState = createState<boolean>({
  key: 'transcriptConnectedState',
  defaultValue: false,
});
