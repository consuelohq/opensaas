import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { PhoneNumberSettings } from '~/pages/settings/consuelo/PhoneNumberSettings';

export const SettingsMercuryPhoneNumbers = () => {
  return (
    <SubMenuTopBarContainer
      title="Phone Numbers"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Mercury',
          href: getSettingsPath(SettingsPath.Mercury),
        },
        { children: 'Phone Numbers' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <PhoneNumberSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
