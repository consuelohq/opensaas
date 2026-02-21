import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { CallingPresenceSettings } from '~/pages/settings/consuelo/CallingPresenceSettings';

export const SettingsMercuryCalling = () => {
  return (
    <SubMenuTopBarContainer
      title="Calling & Presence"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Mercury',
          href: getSettingsPath(SettingsPath.Mercury),
        },
        { children: 'Calling & Presence' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <CallingPresenceSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
