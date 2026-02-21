import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import styled from '@emotion/styled';

const StyledPlaceholder = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const SettingsMercuryProfile = () => {
  return (
    <SubMenuTopBarContainer
      title="Profile"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Mercury',
          href: getSettingsPath(SettingsPath.Mercury),
        },
        { children: 'Profile' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <StyledPlaceholder>Profile settings — coming soon</StyledPlaceholder>
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
