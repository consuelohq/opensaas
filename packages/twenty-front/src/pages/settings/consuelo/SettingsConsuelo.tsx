import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate, useParams } from 'react-router-dom';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import {
  IconHeadphones,
  IconPhone,
  IconRobot,
  IconToggleRight,
  IconCreditCard,
  IconBell,
  IconBuildingSkyscraper,
  IconUserCircle,
} from 'twenty-ui/display';
import { type IconComponent } from 'twenty-ui/display';
import { AudioDeviceSettings } from '~/pages/settings/consuelo/AudioDeviceSettings';
import { AIProviderSettings } from '~/pages/settings/consuelo/AIProviderSettings';
import { PreferencesSettings } from '~/pages/settings/consuelo/PreferencesSettings';
import { WorkspaceSettings } from '~/pages/settings/consuelo/WorkspaceSettings';

type ConsuelloSection = {
  id: string;
  label: string;
  Icon: IconComponent;
};

const CONSUELLO_SECTIONS: ConsuelloSection[] = [
  { id: 'profile', label: 'Profile', Icon: IconUserCircle },
  { id: 'phone-numbers', label: 'Phone Numbers', Icon: IconPhone },
  { id: 'calling', label: 'Calling & Presence', Icon: IconToggleRight },
  { id: 'audio', label: 'Audio Devices', Icon: IconHeadphones },
  { id: 'ai', label: 'AI Provider', Icon: IconRobot },
  { id: 'subscription', label: 'Subscription', Icon: IconCreditCard },
  { id: 'notifications', label: 'Notifications', Icon: IconBell },
  { id: 'workspace', label: 'Workspace', Icon: IconBuildingSkyscraper },
];

const DEFAULT_SECTION = 'profile';

const StyledContainer = styled.div`
  display: flex;
  height: 100%;
`;

const StyledSidebar = styled.nav`
  border-right: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  min-width: 200px;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledSidebarItem = styled.button<{ isActive: boolean }>`
  align-items: center;
  background: ${({ isActive, theme }) =>
    isActive ? theme.background.transparent.light : 'transparent'};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ isActive, theme }) =>
    isActive ? theme.font.color.primary : theme.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledContent = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledPlaceholder = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const SettingsConsuelo = () => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const activeSection = section ?? DEFAULT_SECTION;

  const activeSectionConfig = CONSUELLO_SECTIONS.find(
    (s) => s.id === activeSection,
  );

  const handleSectionClick = (sectionId: string) => {
    navigate(
      getSettingsPath(SettingsPath.ConsuelloSection, { section: sectionId }),
    );
  };

  return (
    <SubMenuTopBarContainer
      title={t`Consuelo`}
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>Consuelo</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <StyledContainer>
          <StyledSidebar>
            {CONSUELLO_SECTIONS.map((item) => (
              <StyledSidebarItem
                key={item.id}
                isActive={activeSection === item.id}
                onClick={() => handleSectionClick(item.id)}
              >
                <item.Icon size={16} />
                {item.label}
              </StyledSidebarItem>
            ))}
          </StyledSidebar>
          <StyledContent>
            {activeSection === 'audio' ? (
              <AudioDeviceSettings />
            ) : activeSection === 'ai' ? (
              <AIProviderSettings />
            ) : activeSection === 'notifications' ? (
              <PreferencesSettings />
            ) : activeSection === 'workspace' ? (
              <WorkspaceSettings />
            ) : (
              <StyledPlaceholder>
                {activeSectionConfig
                  ? `${activeSectionConfig.label} settings — coming in task 7.${CONSUELLO_SECTIONS.indexOf(activeSectionConfig) + 2}`
                  : 'Select a section'}
              </StyledPlaceholder>
            )}
          </StyledContent>
        </StyledContainer>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
