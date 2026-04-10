import { captureException } from '@sentry/react';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { IconCheck, IconSparkles } from '@tabler/icons-react';

import { type WorkspaceSubscriptionStatus } from '@/billing/hooks/useWorkspaceSubscriptionStatus';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { NAVIGATION_DRAWER_UPGRADE_MODAL_ID } from '@/navigation/constants/navigation-drawer-support-menu.constants';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { IconX } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
const CONSUELO_PRICING_URL = 'https://www.consuelohq.com/mercury';

// -- layout --

const StyledModalContent = styled(Modal.Content)`
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
`;

const StyledHeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: 0;
`;

const StyledSubtitle = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.4;
  margin: 0;
`;

// -- table --

const StyledTable = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledTableHeader = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledColumnHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledColumnTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledColumnSubtitle = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledTableRow = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: ${({ theme }) => theme.spacing(2.5, 0)};
`;

const StyledCell = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledStatusDot = styled.span<{ status: 'limited' | 'included' }>`
  background: ${({ status, theme }) =>
    status === 'limited' ? theme.color.red : theme.color.green};
  border-radius: 50%;
  flex-shrink: 0;
  height: 8px;
  width: 8px;
`;

const StyledCheckIcon = styled.span`
  align-items: center;
  background: ${({ theme }) => theme.color.green};
  border-radius: 50%;
  color: white;
  display: inline-flex;
  flex-shrink: 0;
  font-size: 10px;
  height: 16px;
  justify-content: center;
  width: 16px;
`;

// -- footer --

const StyledFooter = styled(Modal.Footer)`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing(0, 5, 4, 5)};
`;

const StyledLinkButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(1, 2)};

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledUpgradeButton = styled.button`
  background: ${({ theme }) => theme.color.blue};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: white;
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(1.5, 3)};

  &:hover {
    filter: brightness(0.95);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

// -- component --

type NavigationDrawerUpgradeModalProps = {
  subscriptionStatus: WorkspaceSubscriptionStatus | null;
};

export const NavigationDrawerUpgradeModal = ({
  subscriptionStatus,
}: NavigationDrawerUpgradeModalProps) => {
  const theme = useTheme();
  const { t } = useLingui();
  const { closeModal } = useModal();
  const { enqueueErrorSnackBar } = useSnackBar();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedPlan = subscriptionStatus?.plan.name?.trim().toLowerCase();
  const isFreePlan =
    !normalizedPlan ||
    normalizedPlan === '' ||
    normalizedPlan === 'none' ||
    normalizedPlan === 'no plan' ||
    normalizedPlan === 'starter';

  const handleClose = () => {
    closeModal(NAVIGATION_DRAWER_UPGRADE_MODAL_ID);
  };

  const handleUpgrade = async () => {
    setIsSubmitting(true);

    try {
      const endpoint = isFreePlan
        ? `${REACT_APP_SERVER_BASE_URL}/v1/subscription/checkout`
        : `${REACT_APP_SERVER_BASE_URL}/v1/subscription/portal`;

      const payload = isFreePlan
        ? {
            interval: 'month',
            successUrl: window.location.href,
            cancelUrl: window.location.href,
          }
        : { returnUrl: window.location.href };

      const response = await authenticatedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        captureException(
          new Error(`Upgrade request failed: ${response.status}`),
          { extra: { context: 'NavigationDrawerUpgradeModal', endpoint } },
        );
        enqueueErrorSnackBar({ message: t`Couldn't open billing right now` });
        return;
      }

      const result = (await response.json()) as { url?: string };

      if (!result.url) {
        captureException(new Error('Missing billing url'), {
          extra: { context: 'NavigationDrawerUpgradeModal' },
        });
        enqueueErrorSnackBar({ message: t`Couldn't open billing right now` });
        return;
      }

      window.location.href = result.url;
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'NavigationDrawerUpgradeModal' },
      });
      enqueueErrorSnackBar({ message: t`Couldn't open billing right now` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const features = [
    { free: t`Basic dialer`, growth: t`Twilio-powered dialing` },
    { free: t`Limited compute`, growth: t`Unlimited compute` },
    { free: t`10MB file limit`, growth: t`10MB file limit` },
    { free: t`No integrations`, growth: t`Integrations` },
  ];

  return (
    <Modal
      modalId={NAVIGATION_DRAWER_UPGRADE_MODAL_ID}
      isClosable={true}
      onClose={handleClose}
      size="medium"
      padding="none"
      shouldCloseModalOnClickOutsideOrEscape={false}
    >
      <StyledModalContent>
        <StyledHeader>
          <StyledHeaderText>
            <StyledTitle>{t`Upgrade your workspace`}</StyledTitle>
            <StyledSubtitle>
              {t`Upgrade to keep creating and access more features.`}
            </StyledSubtitle>
          </StyledHeaderText>
          <LightIconButton
            Icon={IconX}
            accent="tertiary"
            size="small"
            onClick={handleClose}
            aria-label={t`Close`}
          />
        </StyledHeader>

        <StyledTable>
          <StyledTableHeader>
            <StyledColumnHeader>
              <StyledColumnTitle>{t`Current plan`}</StyledColumnTitle>
              <StyledColumnSubtitle>{t`Free`}</StyledColumnSubtitle>
            </StyledColumnHeader>
            <StyledColumnHeader>
              <StyledColumnTitle>{t`Growth`}</StyledColumnTitle>
              <StyledColumnSubtitle>
                {t`$20 per seat/month`}
              </StyledColumnSubtitle>
            </StyledColumnHeader>
          </StyledTableHeader>

          {features.map((row) => (
            <StyledTableRow key={row.free}>
              <StyledCell>
                <StyledStatusDot status="limited" />
                {row.free}
              </StyledCell>
              <StyledCell>
                <StyledCheckIcon>✓</StyledCheckIcon>
                {row.growth}
              </StyledCell>
            </StyledTableRow>
          ))}
        </StyledTable>
      </StyledModalContent>

      <StyledFooter>
        <StyledLinkButton
          type="button"
          onClick={() => {
            window.open(CONSUELO_PRICING_URL, '_blank', 'noopener,noreferrer');
          }}
        >
          {t`See all plans`}
        </StyledLinkButton>
        <StyledUpgradeButton
          type="button"
          onClick={() => {
            void handleUpgrade();
          }}
          disabled={isSubmitting}
        >
          {isFreePlan ? t`Upgrade to Growth` : t`Manage billing`}
        </StyledUpgradeButton>
      </StyledFooter>
    </Modal>
  );
};
