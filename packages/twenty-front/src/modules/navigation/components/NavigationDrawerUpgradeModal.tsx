import { captureException } from '@sentry/react';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { NAVIGATION_DRAWER_UPGRADE_MODAL_ID } from '@/navigation/constants/navigation-drawer-support-menu.constants';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { IconCheck, IconSparkles } from '@tabler/icons-react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { type WorkspaceSubscriptionStatus } from '@/billing/hooks/useWorkspaceSubscriptionStatus';
import { H2Title, IconX } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';

const CONSUELO_PRICING_URL = 'https://www.consuelohq.com/mercury';

const StyledModalContent = styled(Modal.Content)`
  gap: ${({ theme }) => theme.spacing(5)};
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledHeader = styled.div`
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledHeaderCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledEyebrow = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledDescription = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.6;
  margin: 0;
`;

const StyledPlansGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)};
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const StyledPlanCard = styled.div<{ featured?: boolean }>`
  background: ${({ featured, theme }) =>
    featured ? theme.background.transparent.light : theme.background.primary};
  border: 1px solid
    ${({ featured, theme }) =>
      featured ? theme.border.color.strong : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  min-height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledPlanHeading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledPlanTitleRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: space-between;
`;

const StyledPlanTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledPlanBadge = styled.span<{ featured?: boolean }>`
  background: ${({ featured, theme }) =>
    featured ? theme.color.blue + '20' : theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.rounded};
  color: ${({ featured, theme }) =>
    featured ? theme.color.blue : theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(0.5, 1.5)};
  text-transform: uppercase;
`;

const StyledPlanPrice = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xxl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  letter-spacing: -0.03em;
`;

const StyledPlanSubtitle = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledFeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledFeature = styled.div`
  align-items: flex-start;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  line-height: 1.5;
`;

const StyledFooter = styled(Modal.Footer)`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing(0, 5, 5)};
`;

const StyledActionButton = styled.button<{ primary?: boolean }>`
  align-items: center;
  background: ${({ primary, theme }) =>
    primary ? theme.color.blue : theme.background.transparent.light};
  border: 1px solid
    ${({ primary, theme }) =>
      primary ? theme.color.blue : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.rounded};
  color: ${({ primary, theme }) =>
    primary ? theme.grayScale.gray1 : theme.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  height: 36px;
  justify-content: center;
  min-width: 140px;
  padding: ${({ theme }) => theme.spacing(0, 3)};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const getPlanName = (
  subscriptionStatus: WorkspaceSubscriptionStatus | null,
) => {
  const normalizedPlanName = subscriptionStatus?.plan.name
    ?.trim()
    .toLowerCase();

  if (
    normalizedPlanName === undefined ||
    normalizedPlanName === '' ||
    normalizedPlanName === 'no plan' ||
    normalizedPlanName === 'starter'
  ) {
    return 'Free';
  }

  if (normalizedPlanName === 'growth') {
    return 'Growth';
  }

  if (normalizedPlanName === 'enterprise') {
    return 'Enterprise';
  }

  return subscriptionStatus?.plan.name ?? 'Free';
};

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

  const currentPlanName = getPlanName(subscriptionStatus);
  const shouldOpenBillingPortal = currentPlanName !== 'Free';
  const freePlanFeatures = [
    t`1 seat`,
    t`Power dialer`,
    t`Full CRM (contacts, companies, pipeline)`,
    t`50 AI coaching minutes / month`,
    t`Basic analytics`,
  ];
  const growthPlanFeatures = [
    t`Unlimited seats`,
    t`Local presence dialing`,
    t`Multi-line dialing`,
    t`Unlimited AI coaching`,
    t`Call transfer (warm + cold)`,
    t`Full analytics and reporting`,
    t`Priority support`,
  ];

  const handleClose = () => {
    closeModal(NAVIGATION_DRAWER_UPGRADE_MODAL_ID);
  };

  const handleUpgrade = async () => {
    setIsSubmitting(true);

    try {
      const endpoint = shouldOpenBillingPortal
        ? `${REACT_APP_SERVER_BASE_URL}/v1/subscription/portal`
        : `${REACT_APP_SERVER_BASE_URL}/v1/subscription/checkout`;

      const payload = shouldOpenBillingPortal
        ? {
            returnUrl: window.location.href,
          }
        : {
            interval: 'month',
            successUrl: window.location.href,
            cancelUrl: window.location.href,
          };

      const response = await authenticatedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const httpError = new Error(
          `Upgrade request failed: ${response.status}`,
        );

        captureException(httpError, {
          extra: {
            context: 'NavigationDrawerUpgradeModal',
            endpoint,
            responseStatus: response.status,
          },
        });

        throw httpError;
      }

      const result = (await response.json()) as { url?: string };

      if (!result.url) {
        const missingBillingUrlError = new Error('Missing billing url');

        captureException(missingBillingUrlError, {
          extra: {
            context: 'NavigationDrawerUpgradeModal',
            endpoint,
          },
        });

        throw missingBillingUrlError;
      }

      window.location.href = result.url;
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'NavigationDrawerUpgradeModal' },
      });
      enqueueErrorSnackBar({
        message: t`Couldn't open billing right now`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      modalId={NAVIGATION_DRAWER_UPGRADE_MODAL_ID}
      isClosable={true}
      onClose={handleClose}
      size="large"
      padding="none"
    >
      <StyledModalContent>
        <StyledHeader>
          <StyledHeaderCopy>
            <StyledEyebrow>
              <IconSparkles size={theme.icon.size.md} stroke={1.8} />
              {t`Free plan`}
            </StyledEyebrow>
            <H2Title
              title={t`Upgrade your workspace`}
              description={t`Move from the free plan into Growth to unlock hosted dialing, unlimited AI coaching, and team-scale calling.`}
            />
            <StyledDescription>
              {t`You can start with the free CRM, then turn on hosted calling and AI when your team is ready.`}
            </StyledDescription>
          </StyledHeaderCopy>
          <LightIconButton
            Icon={IconX}
            accent="tertiary"
            size="small"
            onClick={handleClose}
            aria-label={t`Close upgrade modal`}
          />
        </StyledHeader>

        <StyledPlansGrid>
          <StyledPlanCard>
            <StyledPlanHeading>
              <StyledPlanTitleRow>
                <StyledPlanTitle>{t`Current plan`}</StyledPlanTitle>
                <StyledPlanBadge>{currentPlanName}</StyledPlanBadge>
              </StyledPlanTitleRow>
              <StyledPlanPrice>{t`$0`}</StyledPlanPrice>
              <StyledPlanSubtitle>{t`Free forever`}</StyledPlanSubtitle>
            </StyledPlanHeading>

            <StyledFeatureList>
              {freePlanFeatures.map((feature) => (
                <StyledFeature key={feature}>
                  <IconCheck size={16} color={theme.color.green} />
                  <span>{feature}</span>
                </StyledFeature>
              ))}
            </StyledFeatureList>
          </StyledPlanCard>

          <StyledPlanCard featured>
            <StyledPlanHeading>
              <StyledPlanTitleRow>
                <StyledPlanTitle>{t`Growth`}</StyledPlanTitle>
                <StyledPlanBadge featured>{t`Recommended`}</StyledPlanBadge>
              </StyledPlanTitleRow>
              <StyledPlanPrice>{t`$20`}</StyledPlanPrice>
              <StyledPlanSubtitle>{t`Per seat / month`}</StyledPlanSubtitle>
            </StyledPlanHeading>

            <StyledFeatureList>
              {growthPlanFeatures.map((feature) => (
                <StyledFeature key={feature}>
                  <IconCheck size={16} color={theme.color.blue} />
                  <span>{feature}</span>
                </StyledFeature>
              ))}
            </StyledFeatureList>
          </StyledPlanCard>
        </StyledPlansGrid>
      </StyledModalContent>

      <StyledFooter>
        <StyledActionButton
          type="button"
          onClick={() => {
            window.open(CONSUELO_PRICING_URL, '_blank', 'noopener,noreferrer');
          }}
        >
          {t`See all plans`}
        </StyledActionButton>
        <StyledActionButton
          type="button"
          primary
          onClick={() => {
            void handleUpgrade();
          }}
          disabled={isSubmitting}
        >
          {shouldOpenBillingPortal ? t`Manage billing` : t`Upgrade to Growth`}
        </StyledActionButton>
      </StyledFooter>
    </Modal>
  );
};
