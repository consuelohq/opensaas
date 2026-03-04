import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { ProfileSettings } from '~/pages/settings/consuelo/ProfileSettings';

export const SettingsMercuryProfile = () => {
  return (
    <SubMenuTopBarContainer
      title="Profile"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Mercury',
          href: getSettingsPath(SettingsPath.Mercury),
        },
        { children: 'Profile' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <ProfileSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
