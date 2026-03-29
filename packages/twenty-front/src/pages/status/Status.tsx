import { captureException } from '@sentry/react';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useLingui } from '@lingui/react/macro';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { type WorkspaceSubscriptionStatus } from '@/billing/hooks/useWorkspaceSubscriptionStatus';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { AppPath } from 'twenty-shared/types';
import {
  IconActivityHeartbeat,
  IconAntennaBars5,
  IconArrowLeft,
  IconClockHour4,
  IconDatabase,
  IconPhone,
  IconRefresh,
  IconServer2,
} from '@tabler/icons-react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type HealthIndicatorStatus = 'up' | 'down';

type PublicHealthResponse = {
  status: 'ok' | 'error';
  info?: {
    database?: { status: HealthIndicatorStatus };
    redis?: { status: HealthIndicatorStatus };
  };
};

type TwilioHealthResponse = {
  healthy: boolean;
  twimlAppSid?: string;
  issues?: string[];
};

type AnalyticsMetricsResponse = {
  metrics: {
    totalCalls: number;
    answeredCalls: number;
    answerRate: number;
    avgDuration: number;
    callsToday: number;
    callsThisWeek: number;
  };
};

type StatusPageData = {
  publicHealth: PublicHealthResponse | null;
  twilioHealth: TwilioHealthResponse | null;
  analytics: AnalyticsMetricsResponse['metrics'] | null;
  subscription: WorkspaceSubscriptionStatus | null;
  hasWorkspaceMetrics: boolean;
};

const StyledPage = styled.div`
  background: ${({ theme }) => theme.background.noisy};
  color: ${({ theme }) => theme.font.color.primary};
  min-height: 100dvh;
  padding: ${({ theme }) => theme.spacing(6)};
`;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(6)};
  margin: 0 auto;
  max-width: 1040px;
`;

const StyledTopBar = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: space-between;
  flex-wrap: wrap;
`;

const StyledTopBarActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledButton = styled.button`
  align-items: center;
  background: ${({ theme }) => theme.background.transparent.light};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.rounded};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing(1.5)};
  height: 36px;
  padding: ${({ theme }) => theme.spacing(0, 3)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledHero = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitle = styled.h1`
  font-size: clamp(2rem, 1.7rem + 2vw, 3rem);
  letter-spacing: -0.04em;
  line-height: 1;
  margin: 0;
`;

const StyledSubtitle = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.6;
  margin: 0;
  max-width: 720px;
`;

const StyledBanner = styled.div<{ healthy: boolean }>`
  background: ${({ healthy, theme }) =>
    healthy ? theme.color.green + '18' : theme.color.orange + '18'};
  border: 1px solid
    ${({ healthy, theme }) =>
      healthy ? theme.color.green + '55' : theme.color.orange + '55'};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledBannerTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledBannerDescription = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.6;
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledSectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.lg};
  margin: 0;
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)};
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const StyledCard = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledCardHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledCardTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledMetricValue = styled.div`
  font-size: ${({ theme }) => theme.font.size.xxl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  letter-spacing: -0.04em;
`;

const StyledMetricLabel = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledIssueList = styled.ul`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing(4)};
`;

const StyledEmptyState = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatSeconds = (value: number) => {
  const roundedValue = Math.round(value);
  const minutes = Math.floor(roundedValue / 60);
  const seconds = roundedValue % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
};

export const Status = () => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const workspaceName = currentWorkspace?.displayName ?? '';
  const [loading, setLoading] = useState(true);
  const [statusPageData, setStatusPageData] = useState<StatusPageData>({
    publicHealth: null,
    twilioHealth: null,
    analytics: null,
    subscription: null,
    hasWorkspaceMetrics: false,
  });

  const loadStatusPageData = useCallback(async () => {
    setLoading(true);

    try {
      const publicHealthPromise = fetch('/healthz').then(async (response) => {
        if (!response.ok) {
          throw new Error(`Healthz failed: ${response.status}`);
        }

        return (await response.json()) as PublicHealthResponse;
      });

      const [
        publicHealth,
        twilioResponse,
        analyticsResponse,
        subscriptionResponse,
      ] = await Promise.all([
        publicHealthPromise,
        authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/settings/twilio/health`,
        ),
        authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/analytics/metrics?period=week`,
        ),
        authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/subscription/status`,
        ),
      ]);

      const hasWorkspaceMetrics =
        twilioResponse.ok && analyticsResponse.ok && subscriptionResponse.ok;

      setStatusPageData({
        publicHealth,
        twilioHealth: twilioResponse.ok
          ? ((await twilioResponse.json()) as TwilioHealthResponse)
          : null,
        analytics: analyticsResponse.ok
          ? ((await analyticsResponse.json()) as AnalyticsMetricsResponse)
              .metrics
          : null,
        subscription: subscriptionResponse.ok
          ? ((await subscriptionResponse.json()) as WorkspaceSubscriptionStatus)
          : null,
        hasWorkspaceMetrics,
      });
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'status-page' },
      });
      setStatusPageData({
        publicHealth: null,
        twilioHealth: null,
        analytics: null,
        subscription: null,
        hasWorkspaceMetrics: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatusPageData();
  }, [loadStatusPageData]);

  const isOperational = useMemo(() => {
    const publicHealthOperational =
      statusPageData.publicHealth?.status === 'ok';
    const twilioOperational = statusPageData.twilioHealth?.healthy ?? true;

    return publicHealthOperational && twilioOperational;
  }, [
    statusPageData.publicHealth?.status,
    statusPageData.twilioHealth?.healthy,
  ]);

  return (
    <StyledPage>
      <StyledContainer>
        <StyledTopBar>
          <StyledTopBarActions>
            <StyledButton type="button" onClick={() => navigate(AppPath.Index)}>
              <IconArrowLeft size={16} />
              {t`Back to app`}
            </StyledButton>
          </StyledTopBarActions>

          <StyledButton
            type="button"
            onClick={() => {
              void loadStatusPageData();
            }}
          >
            <IconRefresh size={16} />
            {t`Refresh`}
          </StyledButton>
        </StyledTopBar>

        <StyledHero>
          <StyledTitle>{t`Consuelo status`}</StyledTitle>
          <StyledSubtitle>
            {t`Track app health, Twilio connectivity, and workspace calling metrics from one place.`}
          </StyledSubtitle>
        </StyledHero>

        <StyledBanner healthy={isOperational}>
          <StyledBannerTitle>
            {isOperational
              ? t`We're fully operational`
              : t`We're seeing degraded service`}
          </StyledBannerTitle>
          <StyledBannerDescription>
            {isOperational
              ? t`No known issues are affecting the core platform right now.`
              : t`One or more services need attention. Refresh this page or open support if something looks off.`}
          </StyledBannerDescription>
        </StyledBanner>

        <StyledSection>
          <StyledSectionTitle>{t`Platform health`}</StyledSectionTitle>
          <StyledGrid>
            <StyledCard>
              <StyledCardHeader>
                <IconActivityHeartbeat size={20} />
                <StyledCardTitle>{t`Application`}</StyledCardTitle>
              </StyledCardHeader>
              <StyledMetricValue>
                {statusPageData.publicHealth?.status === 'ok'
                  ? t`Healthy`
                  : t`Unknown`}
              </StyledMetricValue>
              <StyledMetricLabel>{t`Public health endpoint`}</StyledMetricLabel>
            </StyledCard>

            <StyledCard>
              <StyledCardHeader>
                <IconDatabase size={20} />
                <StyledCardTitle>{t`Database`}</StyledCardTitle>
              </StyledCardHeader>
              <StyledMetricValue>
                {statusPageData.publicHealth?.info?.database?.status === 'up'
                  ? t`Up`
                  : t`Unknown`}
              </StyledMetricValue>
              <StyledMetricLabel>{t`Primary persistence layer`}</StyledMetricLabel>
            </StyledCard>

            <StyledCard>
              <StyledCardHeader>
                <IconServer2 size={20} />
                <StyledCardTitle>{t`Redis`}</StyledCardTitle>
              </StyledCardHeader>
              <StyledMetricValue>
                {statusPageData.publicHealth?.info?.redis?.status === 'up'
                  ? t`Up`
                  : t`Unknown`}
              </StyledMetricValue>
              <StyledMetricLabel>{t`Cache and realtime layer`}</StyledMetricLabel>
            </StyledCard>

            <StyledCard>
              <StyledCardHeader>
                <IconAntennaBars5 size={20} />
                <StyledCardTitle>{t`Twilio`}</StyledCardTitle>
              </StyledCardHeader>
              <StyledMetricValue>
                {statusPageData.twilioHealth === null
                  ? t`Unavailable`
                  : statusPageData.twilioHealth.healthy
                    ? t`Connected`
                    : t`Attention`}
              </StyledMetricValue>
              <StyledMetricLabel>{t`Workspace telephony health`}</StyledMetricLabel>
              {statusPageData.twilioHealth?.issues !== undefined &&
                statusPageData.twilioHealth.issues.length > 0 && (
                  <StyledIssueList>
                    {statusPageData.twilioHealth.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </StyledIssueList>
                )}
            </StyledCard>
          </StyledGrid>
        </StyledSection>

        <StyledSection>
          <StyledSectionTitle>
            {workspaceName
              ? t`${workspaceName} call metrics`
              : t`Workspace call metrics`}
          </StyledSectionTitle>

          {loading ? (
            <StyledEmptyState>{t`Loading metrics...`}</StyledEmptyState>
          ) : statusPageData.hasWorkspaceMetrics ? (
            <StyledGrid>
              <StyledCard>
                <StyledCardHeader>
                  <IconPhone size={20} />
                  <StyledCardTitle>{t`Calls today`}</StyledCardTitle>
                </StyledCardHeader>
                <StyledMetricValue>
                  {statusPageData.analytics?.callsToday ?? 0}
                </StyledMetricValue>
                <StyledMetricLabel>{t`Outbound calls started today`}</StyledMetricLabel>
              </StyledCard>

              <StyledCard>
                <StyledCardHeader>
                  <IconPhone size={20} />
                  <StyledCardTitle>{t`Calls this week`}</StyledCardTitle>
                </StyledCardHeader>
                <StyledMetricValue>
                  {statusPageData.analytics?.callsThisWeek ?? 0}
                </StyledMetricValue>
                <StyledMetricLabel>{t`Rolling seven day call count`}</StyledMetricLabel>
              </StyledCard>

              <StyledCard>
                <StyledCardHeader>
                  <IconAntennaBars5 size={20} />
                  <StyledCardTitle>{t`Answer rate`}</StyledCardTitle>
                </StyledCardHeader>
                <StyledMetricValue>
                  {formatPercent(statusPageData.analytics?.answerRate ?? 0)}
                </StyledMetricValue>
                <StyledMetricLabel>{t`Answered vs total calls`}</StyledMetricLabel>
              </StyledCard>

              <StyledCard>
                <StyledCardHeader>
                  <IconClockHour4 size={20} />
                  <StyledCardTitle>{t`Average duration`}</StyledCardTitle>
                </StyledCardHeader>
                <StyledMetricValue>
                  {formatSeconds(statusPageData.analytics?.avgDuration ?? 0)}
                </StyledMetricValue>
                <StyledMetricLabel>{t`Average connected call length`}</StyledMetricLabel>
              </StyledCard>

              <StyledCard>
                <StyledCardHeader>
                  <IconPhone size={20} />
                  <StyledCardTitle>{t`Call minutes used`}</StyledCardTitle>
                </StyledCardHeader>
                <StyledMetricValue>
                  {statusPageData.subscription?.usage.callMinutes.used ?? 0}
                </StyledMetricValue>
                <StyledMetricLabel>
                  {t`Current subscription usage this period`}
                </StyledMetricLabel>
              </StyledCard>

              <StyledCard>
                <StyledCardHeader>
                  <IconServer2 size={20} />
                  <StyledCardTitle>{t`Current plan`}</StyledCardTitle>
                </StyledCardHeader>
                <StyledMetricValue>
                  {statusPageData.subscription?.plan.name ?? t`Unavailable`}
                </StyledMetricValue>
                <StyledMetricLabel>
                  {statusPageData.subscription?.plan.interval === 'year'
                    ? t`Billed yearly`
                    : statusPageData.subscription?.plan.interval === 'month'
                      ? t`Billed monthly`
                      : t`No billing interval`}
                </StyledMetricLabel>
              </StyledCard>
            </StyledGrid>
          ) : (
            <StyledEmptyState>
              {t`Sign in with a workspace session to see Twilio and call usage details.`}
            </StyledEmptyState>
          )}
        </StyledSection>
      </StyledContainer>
    </StyledPage>
  );
};
