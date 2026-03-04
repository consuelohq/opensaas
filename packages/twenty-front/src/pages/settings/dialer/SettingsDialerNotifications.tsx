import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { PreferencesSettings } from '~/pages/settings/consuelo/PreferencesSettings';

export const SettingsDialerNotifications = () => {
  return (
    <SubMenuTopBarContainer
      title="Notifications"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Dialer',
          href: getSettingsPath(SettingsPath.Dialer),
        },
        { children: 'Notifications' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <PreferencesSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
