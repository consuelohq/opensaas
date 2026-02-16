import { useState } from 'react';
import styled from '@emotion/styled';
import { useWorkspaceSettings } from '@/settings/hooks/useWorkspaceSettings';
import { GeneralTab } from './workspace/GeneralTab';
import { BrandingTab } from './workspace/BrandingTab';
import { TeamTab } from './workspace/TeamTab';
import { BillingTab } from './workspace/BillingTab';

const TABS = ['General', 'Branding', 'Team', 'Billing'] as const;
type Tab = (typeof TABS)[number];

const StyledTabBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledTab = styled.button<{ active: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background: none;
  border: none;
  border-bottom: 2px solid
    ${({ active, theme }) => (active ? theme.font.color.primary : 'transparent')};
  color: ${({ active, theme }) =>
    active ? theme.font.color.primary : theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledLoading = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  padding: ${({ theme }) => theme.spacing(4)};
`;

export const WorkspaceSettings = () => {
  const [tab, setTab] = useState<Tab>('General');
  const {
    workspace,
    loading,
    updateWorkspace,
    updateBranding,
    inviteMember,
    updateMemberRole,
    removeMember,
    openBillingPortal,
  } = useWorkspaceSettings();

  if (loading) return <StyledLoading>Loading workspace...</StyledLoading>;

  return (
    <>
      <StyledTabBar>
        {TABS.map((t) => (
          <StyledTab key={t} active={t === tab} onClick={() => setTab(t)}>
            {t}
          </StyledTab>
        ))}
      </StyledTabBar>
      {tab === 'General' && (
        <GeneralTab workspace={workspace} onSave={updateWorkspace} />
      )}
      {tab === 'Branding' && (
        <BrandingTab branding={workspace.branding} onSave={updateBranding} />
      )}
      {tab === 'Team' && (
        <TeamTab
          team={workspace.team}
          seats={workspace.billing.seats}
          onInvite={inviteMember}
          onUpdateRole={updateMemberRole}
          onRemove={removeMember}
        />
      )}
      {tab === 'Billing' && (
        <BillingTab
          billing={workspace.billing}
          limits={workspace.limits}
          onManageBilling={openBillingPortal}
        />
      )}
    </>
  );
};
