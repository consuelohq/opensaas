import { createState } from '@/ui/utilities/state/utils/createState';

export const selectedSpeakerState = createState<string | null>({
  key: 'dialerSelectedSpeakerState',
  defaultValue: null,
});
