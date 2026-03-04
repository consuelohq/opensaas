import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { TwilioSettings } from '~/pages/settings/consuelo/TwilioSettings';

export const SettingsDialerTwilio = () => {
  return (
    <SubMenuTopBarContainer
      title="Twilio"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Dialer',
          href: getSettingsPath(SettingsPath.Dialer),
        },
        { children: 'Twilio' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <TwilioSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
