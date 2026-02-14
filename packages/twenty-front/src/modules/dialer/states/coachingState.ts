import { selector } from 'recoil';

import { createState } from '@/ui/utilities/state/utils/createState';
import { type CallAnalytics, type TalkingPoints, type TranscriptEntry } from '@/dialer/types/coaching';

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

export const postCallAnalysisState = createState<CallAnalytics | null>({
  key: 'postCallAnalysisState',
  defaultValue: null,
});

export const isAnalyzingState = createState<boolean>({
  key: 'isAnalyzingState',
  defaultValue: false,
});

export const transcriptErrorState = createState<string | null>({
  key: 'transcriptErrorState',
  defaultValue: null,
});

export const analysisErrorState = createState<string | null>({
  key: 'analysisErrorState',
  defaultValue: null,
});

export const coachingStateSelector = selector({
  key: 'coachingStateSelector',
  get: ({ get }) => ({
    isLoading: get(coachingLoadingState),
    talkingPoints: get(talkingPointsState),
    error: get(coachingErrorState),
  }),
});

export const transcriptSelector = selector({
  key: 'transcriptSelector',
  get: ({ get }) => {
    const entries = get(transcriptState);
    return {
      entries,
      wordCount: entries.reduce((sum, e) => sum + e.text.split(' ').length, 0),
      agentTalkTime: entries.filter((e) => e.speaker === 'agent').length,
      customerTalkTime: entries.filter((e) => e.speaker === 'customer').length,
    };
  },
});
