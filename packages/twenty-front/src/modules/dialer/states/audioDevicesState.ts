import { createState } from '@/ui/utilities/state/utils/createState';

export const audioDevicesState = createState<MediaDeviceInfo[]>({
  key: 'dialerAudioDevicesState',
  defaultValue: [],
});
