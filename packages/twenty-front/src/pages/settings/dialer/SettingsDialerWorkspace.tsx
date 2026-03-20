import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { WorkspaceSettings } from '~/pages/settings/consuelo/WorkspaceSettings';

export const SettingsDialerWorkspace = () => {
  return (
    <SubMenuTopBarContainer
      title="Org/Workspace"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>Org/Workspace</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <WorkspaceSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
