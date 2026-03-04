import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { H2Title } from 'twenty-ui/display';
import { Section } from 'twenty-ui/layout';

export const SettingsDialer = () => {
  return (
    <SubMenuTopBarContainer
      title="Dialer"
      links={[
        {
          children: 'Workspace',
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: 'Dialer' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title="Dialer"
            description="Configure your calling, AI coaching, and workspace settings using the sidebar navigation."
          />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
