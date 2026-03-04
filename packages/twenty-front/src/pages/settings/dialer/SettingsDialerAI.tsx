import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { AIProviderSettings } from '~/pages/settings/consuelo/AIProviderSettings';

export const SettingsDialerAI = () => {
  return (
    <SubMenuTopBarContainer
      title="AI Provider"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Dialer',
          href: getSettingsPath(SettingsPath.Dialer),
        },
        { children: 'AI Provider' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <AIProviderSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
