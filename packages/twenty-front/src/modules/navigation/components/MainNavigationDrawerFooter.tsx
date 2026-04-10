import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';

import { useWorkspaceSubscriptionStatus } from '@/billing/hooks/useWorkspaceSubscriptionStatus';
import { NavigationDrawerUpgradeModal } from '@/navigation/components/NavigationDrawerUpgradeModal';
import { NavigationDrawerHelpDropdown } from '@/navigation/components/NavigationDrawerHelpDropdown';
import { NAVIGATION_DRAWER_UPGRADE_MODAL_ID } from '@/navigation/constants/navigation-drawer-support-menu.constants';
import { useModal } from '@/ui/layout/modal/hooks/useModal';

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
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.inverted};
  border-radius: 50%;
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  flex-shrink: 0;
  height: ${({ theme }) => theme.spacing(8)};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(1)};
  transition:
    background ${({ theme }) => theme.animation.duration.normal}s,
    border-color ${({ theme }) => theme.animation.duration.normal}s;
  width: ${({ theme }) => theme.spacing(8)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    border-color: ${({ theme }) => theme.border.color.inverted};
  }
`;

const StyledPlanLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.xxs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: 1;
  text-align: center;
`;

export const MainNavigationDrawerFooter = () => {
  const { t } = useLingui();
  const { openModal } = useModal();
  const { subscriptionStatus } = useWorkspaceSubscriptionStatus();

  const planLabel = useMemo(() => {
    const normalizedPlanName = subscriptionStatus?.plan.name
      ?.trim()
      .toLowerCase();

    if (
      normalizedPlanName === undefined ||
      normalizedPlanName === '' ||
      normalizedPlanName === 'no plan' ||
      normalizedPlanName === 'starter'
    ) {
      return t`Free`;
    }

    return t`Pro`;
  }, [subscriptionStatus?.plan.name, t]);

  return (
    <>
      <NavigationDrawerUpgradeModal subscriptionStatus={subscriptionStatus} />

      <StyledFooterRow>
        <NavigationDrawerHelpDropdown />

        <StyledPlanButton
          type="button"
          onClick={() => openModal(NAVIGATION_DRAWER_UPGRADE_MODAL_ID)}
        >
          <StyledPlanLabel>{planLabel}</StyledPlanLabel>
        </StyledPlanButton>
      </StyledFooterRow>
    </>
  );
};
