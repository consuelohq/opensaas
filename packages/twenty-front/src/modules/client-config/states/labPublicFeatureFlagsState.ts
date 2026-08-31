import { atom } from 'recoil';
import { type PublicFeatureFlag } from '@/client-config/types/ClientConfig';

export const labPublicFeatureFlagsState = atom<PublicFeatureFlag[]>({
  key: 'labPublicFeatureFlagsState',
  default: [],
});
