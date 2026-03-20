import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { DiscordSettings } from '~/pages/settings/consuelo/DiscordSettings';

export const SettingsDialerDiscord = () => {
  return (
    <SubMenuTopBarContainer
      title="Discord Bot"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>Discord Bot</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <DiscordSettings />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
