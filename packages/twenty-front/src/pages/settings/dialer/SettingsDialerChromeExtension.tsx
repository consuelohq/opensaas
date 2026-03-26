import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { ChromeExtensionSettings } from '~/pages/settings/consuelo/ChromeExtensionSettings';

export const SettingsDialerChromeExtension = () => {
  return (
    <SubMenuTopBarContainer
      title="Chrome Extension"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>Chrome Extension</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <ChromeExtensionSettings />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
