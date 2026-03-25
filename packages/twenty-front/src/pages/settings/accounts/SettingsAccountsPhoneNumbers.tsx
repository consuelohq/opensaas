import { SettingsAccountsPhoneNumbersContent } from '@/settings/accounts/components/SettingsAccountsPhoneNumbersContent';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';

export const SettingsAccountsPhoneNumbers = () => {
  const { t } = useLingui();

  return (
    <SubMenuTopBarContainer
      title={t`Phone Numbers`}
      links={[
        {
          children: t`User`,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: t`Phone Numbers` },
      ]}
    >
      <SettingsPageContainer>
        <SettingsAccountsPhoneNumbersContent />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
