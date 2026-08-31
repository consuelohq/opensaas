import { type Captcha } from '@/client-config/types/ClientConfig';
import { createState } from '@/ui/utilities/state/utils/createState';

export const captchaState = createState<Captcha | null>({
  key: 'captchaState',
  defaultValue: null,
});
