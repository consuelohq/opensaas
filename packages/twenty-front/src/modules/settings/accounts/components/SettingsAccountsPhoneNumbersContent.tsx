import { SettingsAccountsPhoneNumbersTabContent } from '@/settings/accounts/components/SettingsAccountsPhoneNumbersTabContent';
import { SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS } from '@/settings/accounts/constants/SettingsAccountsPhoneNumbersTabs';
import { SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS_ID } from '@/settings/accounts/constants/SettingsAccountsPhoneNumbersTabsId';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { t } from '@lingui/core/macro';
import { IconHeadphones, IconPhone, IconToggleRight } from 'twenty-ui/display';

export const SettingsAccountsPhoneNumbersContent = () => {
  const tabs = [
    {
      id: SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS.PHONE_NUMBERS,
      title: t`Phone Numbers`,
      Icon: IconPhone,
    },
    {
      id: SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS.CALLING_PRESENCE,
      title: t`Calling & Presence`,
      Icon: IconToggleRight,
    },
    {
      id: SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS.AUDIO_DEVICES,
      title: t`Audio Devices`,
      Icon: IconHeadphones,
    },
  ];

  return (
    <>
      <TabList
        tabs={tabs}
        behaveAsLinks={true}
        componentInstanceId={SETTINGS_ACCOUNTS_PHONE_NUMBERS_TABS_ID}
      />
      <SettingsAccountsPhoneNumbersTabContent />
    </>
  );
};
