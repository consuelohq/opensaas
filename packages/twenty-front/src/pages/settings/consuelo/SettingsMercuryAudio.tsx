import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { AudioDeviceSettings } from '~/pages/settings/consuelo/AudioDeviceSettings';

export const SettingsMercuryAudio = () => {
  return (
    <SubMenuTopBarContainer
      title="Audio Devices"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Mercury',
          href: getSettingsPath(SettingsPath.Mercury),
        },
        { children: 'Audio Devices' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <AudioDeviceSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
