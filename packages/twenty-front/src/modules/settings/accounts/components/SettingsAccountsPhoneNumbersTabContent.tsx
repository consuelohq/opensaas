import { SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS } from '@/settings/accounts/constants/SettingsAccountsPhoneNumbersTabs';
import { SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS_ID } from '@/settings/accounts/constants/SettingsAccountsPhoneNumbersTabsId';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useRecoilComponentValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue';
import { AudioDeviceSettings } from '~/pages/settings/consuelo/AudioDeviceSettings';
import { CallingPresenceSettings } from '~/pages/settings/consuelo/CallingPresenceSettings';
import { PhoneNumberSettings } from '~/pages/settings/consuelo/PhoneNumberSettings';

export const SettingsAccountsPhoneNumbersTabContent = () => {
  const activeTabId = useRecoilComponentValue(
    activeTabIdComponentState,
    SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS_ID,
  );

  switch (activeTabId) {
    case SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS.PHONE_NUMBERS:
      return <PhoneNumberSettings />;
    case SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS.CALLING_PRESENCE:
      return <CallingPresenceSettings />;
    case SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS.AUDIO_DEVICES:
      return <AudioDeviceSettings />;
    default:
      return <PhoneNumberSettings />;
  }
};
