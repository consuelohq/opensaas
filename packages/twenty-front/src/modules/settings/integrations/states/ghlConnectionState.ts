import { createState } from '@/ui/utilities/state/utils/createState';

export type GHLConnectionStatus = {
  connected: boolean;
  locationId: string | null;
  locationName: string | null;
  connectedAt: string | null;
};

export const ghlConnectionState = createState<GHLConnectionStatus>({
  key: 'ghlConnectionStatus',
  defaultValue: {
    connected: false,
    locationId: null,
    locationName: null,
    connectedAt: null,
  },
});
