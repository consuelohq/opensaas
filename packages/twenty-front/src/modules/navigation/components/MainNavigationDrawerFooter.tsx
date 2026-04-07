import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';

import { useWorkspaceSubscriptionStatus } from '@/billing/hooks/useWorkspaceSubscriptionStatus';
import { NavigationDrawerUpgradeModal } from '@/navigation/components/NavigationDrawerUpgradeModal';
import { NavigationDrawerHelpDropdown } from '@/navigation/components/NavigationDrawerHelpDropdown';
import { NAVIGATION_DRAWER_UPGRADE_MODAL_ID } from '@/navigation/constants/navigation-drawer-support-menu.constants';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { NavigationDrawerAnimatedCollapseWrapper } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerAnimatedCollapseWrapper';

const StyledFooterRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-start;
  padding: ${({ theme }) => theme.spacing(0.5, 1, 1, 0.5)};
  width: 100%;
`;

const StyledPlanButton = styled.button`
  align-items: center;
  background: ${({ theme }) => theme.background.transparent.light};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.rounded};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  height: ${({ theme }) => theme.spacing(7)};
  max-width: 100%;
  min-width: ${({ theme }) => theme.spacing(8)};
  padding: ${({ theme }) => theme.spacing(0, 2.5)};
  transition:
    background ${({ theme }) => theme.animation.duration.normal}s,
    transform ${({ theme }) => theme.animation.duration.normal}s;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
    transform: translateY(-1px);
  }
`;

const StyledPlanLabel = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const getPlanLabel = (
  rawPlanName: string | undefined,
  t: ReturnType<typeof useLingui>['t'],
) => {
  const normalizedPlanName = rawPlanName?.trim().toLowerCase();

  if (
    normalizedPlanName === undefined ||
    normalizedPlanName === '' ||
    normalizedPlanName === 'no plan' ||
    normalizedPlanName === 'starter'
  ) {
    return t`Free plan`;
  }

  return t`Paid plan`;
};

export const MainNavigationDrawerFooter = () => {
  const { t } = useLingui();
  const { openModal } = useModal();
  const { subscriptionStatus } = useWorkspaceSubscriptionStatus();

  const planLabel = useMemo(
    () => getPlanLabel(subscriptionStatus?.plan.name, t),
    [subscriptionStatus?.plan.name, t],
  );

  return (
    <>
      <NavigationDrawerUpgradeModal subscriptionStatus={subscriptionStatus} />

      <StyledFooterRow>
        <NavigationDrawerHelpDropdown />

        <StyledPlanButton
          type="button"
          onClick={() => openModal(NAVIGATION_DRAWER_UPGRADE_MODAL_ID)}
        >
          <NavigationDrawerAnimatedCollapseWrapper>
            <StyledPlanLabel>{planLabel}</StyledPlanLabel>
          </NavigationDrawerAnimatedCollapseWrapper>
        </StyledPlanButton>
      </StyledFooterRow>
    </>
  );
};
