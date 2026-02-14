import { createState } from '@/ui/utilities/state/utils/createState';
import { type TalkingPoints } from '@/dialer/types/coaching';

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
