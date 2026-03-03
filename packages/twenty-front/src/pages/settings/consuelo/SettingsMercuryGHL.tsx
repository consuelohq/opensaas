import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { GHLSettings } from '~/pages/settings/consuelo/GHLSettings';

export const SettingsMercuryGHL = () => {
  return (
    <SubMenuTopBarContainer
      title="GHL Integration"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Mercury',
          href: getSettingsPath(SettingsPath.Mercury),
        },
        { children: 'GHL Integration' },
      ]}
    >
      <SettingsPageContainer>
        <GHLSettings />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
