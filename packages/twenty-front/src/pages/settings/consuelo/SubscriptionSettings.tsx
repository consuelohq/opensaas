import { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  IconCheck,
  IconClock,
  IconKey,
  IconRocket,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { captureException } from '@sentry/react';
import { H2Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

type BillingMode = 'hosted' | 'byok';
type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
type AddOnKey = 'dialer-coach' | 'ai-assistant';

type SubscriptionStatusResponse = {
  workspaceId: string;
  mode: BillingMode;
  plan: {
    name: string;
    status: PlanStatus;
    interval: 'month' | 'year' | null;
    currentPeriodEnd: string | null;
  };
  addOns: AddOnKey[];
  usage: {
    callMinutes: { used: number; limit: number | null };
    aiTokens: { used: number; limit: number | null };
  };
  byokKeys: {
    twilio: boolean;
    groq: boolean;
    openai: boolean;
  } | null;
  stripeCustomerId: string | null;
};

const StyledCardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledPlanRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledPlanName = styled.span`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledBadge = styled.span<{ variant: 'trial' | 'active' | 'error' }>`
  background: ${({ variant, theme }) =>
    variant === 'active'
      ? theme.color.green + '20'
      : variant === 'error'
        ? theme.color.red + '20'
        : theme.color.blue + '20'};
  border-radius: 12px;
  color: ${({ variant, theme }) =>
    variant === 'active'
      ? theme.color.green
      : variant === 'error'
        ? theme.color.red
        : theme.color.blue};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: 2px 10px;
`;

const StyledMeterLabel = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: space-between;
`;

const StyledMeterTrack = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
`;

const StyledMeterFill = styled.div<{ percent: number; warn: boolean }>`
  background: ${({ warn, theme }) =>
    warn ? theme.color.red : theme.color.blue};
  border-radius: 4px;
  height: 100%;
  width: ${({ percent }) => Math.min(percent, 100)}%;
`;

const StyledHint = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledAddonRow = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} 0`};
`;

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledKeyRow = styled.div`
  align-items: center;
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(1)};
`;

function badgeVariant(
  status: PlanStatus,
): 'trial' | 'active' | 'error' {
  if (status === 'active') return 'active';
  if (status === 'past_due' || status === 'canceled') return 'error';
  return 'trial';
}

export const SubscriptionSettings = () => {
  const [data, setData] = useState<SubscriptionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/subscription/status`,
      );
      if (res.ok) {
        setData((await res.json()) as SubscriptionStatusResponse);
      }
    } catch (err: unknown) {
      captureException(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleCheckout = useCallback(async () => {
    setActionLoading(true);
    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/subscription/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            successUrl: `${window.location.origin}/settings/mercury/subscription?success=true`,
            cancelUrl: `${window.location.origin}/settings/mercury/subscription`,
          }),
        },
      );
      const result = (await res.json()) as { url?: string };
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: unknown) {
      captureException(err);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handlePortal = useCallback(async () => {
    setActionLoading(true);
    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/subscription/portal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            returnUrl: `${window.location.origin}/settings/mercury/subscription`,
          }),
        },
      );
      const result = (await res.json()) as { url?: string };
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: unknown) {
      captureException(err);
    } finally {
      setActionLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <Section>
        <StyledHint>Loading subscription...</StyledHint>
      </Section>
    );
  }

  if (!data) {
    return (
      <Section>
        <StyledHint>Unable to load subscription status</StyledHint>
      </Section>
    );
  }

  const { plan, mode, addOns, usage, byokKeys } = data;
  const isSubscribed = plan.status === 'active' || plan.status === 'trialing';

  return (
    <>
      <Section>
        <H2Title title="Current Plan" description="Your subscription" />
        <Card rounded>
          <StyledCardContent>
            <StyledPlanRow>
              <StyledPlanName>
                {plan.name === 'none' ? 'No Plan' : plan.name}
                {addOns.length > 0 && ` + ${addOns.join(', ')}`}
              </StyledPlanName>
              {plan.status !== 'none' && (
                <StyledBadge variant={badgeVariant(plan.status)}>
                  {plan.status}
                </StyledBadge>
              )}
            </StyledPlanRow>

            {mode === 'byok' && (
              <StyledHint>
                Mode: Bring Your Own Keys — no usage limits
              </StyledHint>
            )}

            {mode === 'hosted' && (
              <>
                <div>
                  <StyledMeterLabel>
                    <span>
                      <IconClock size={14} style={{ marginRight: 4 }} />
                      Call minutes
                    </span>
                    <span>
                      {usage.callMinutes.used}
                      {usage.callMinutes.limit
                        ? ` / ${usage.callMinutes.limit}`
                        : ''}
                    </span>
                  </StyledMeterLabel>
                  {usage.callMinutes.limit && (
                    <StyledMeterTrack>
                      <StyledMeterFill
                        percent={
                          (usage.callMinutes.used / usage.callMinutes.limit) *
                          100
                        }
                        warn={
                          usage.callMinutes.used / usage.callMinutes.limit > 0.9
                        }
                      />
                    </StyledMeterTrack>
                  )}
                </div>
                <div>
                  <StyledMeterLabel>
                    <span>
                      <IconSparkles size={14} style={{ marginRight: 4 }} />
                      AI tokens
                    </span>
                    <span>
                      {usage.aiTokens.used.toLocaleString()}
                      {usage.aiTokens.limit
                        ? ` / ${usage.aiTokens.limit.toLocaleString()}`
                        : ''}
                    </span>
                  </StyledMeterLabel>
                  {usage.aiTokens.limit && (
                    <StyledMeterTrack>
                      <StyledMeterFill
                        percent={
                          (usage.aiTokens.used / usage.aiTokens.limit) * 100
                        }
                        warn={
                          usage.aiTokens.used / usage.aiTokens.limit > 0.9
                        }
                      />
                    </StyledMeterTrack>
                  )}
                </div>
              </>
            )}

            {plan.currentPeriodEnd && (
              <StyledHint>
                {plan.interval === 'year' ? 'Annual' : 'Monthly'} — renews{' '}
                {new Date(plan.currentPeriodEnd).toLocaleDateString()}
              </StyledHint>
            )}
          </StyledCardContent>
        </Card>
      </Section>

      {byokKeys && (
        <Section>
          <H2Title
            title="Your Keys"
            description="API keys configured for BYOK"
          />
          <Card rounded>
            <StyledCardContent>
              <StyledKeyRow>
                <IconKey size={14} />
                Twilio{' '}
                {byokKeys.twilio ? (
                  <IconCheck size={14} color="green" />
                ) : (
                  <IconX size={14} color="red" />
                )}
              </StyledKeyRow>
              <StyledKeyRow>
                <IconKey size={14} />
                Groq{' '}
                {byokKeys.groq ? (
                  <IconCheck size={14} color="green" />
                ) : (
                  <IconX size={14} color="red" />
                )}
              </StyledKeyRow>
              <StyledKeyRow>
                <IconKey size={14} />
                OpenAI{' '}
                {byokKeys.openai ? (
                  <IconCheck size={14} color="green" />
                ) : (
                  <IconX size={14} color="red" />
                )}
              </StyledKeyRow>
            </StyledCardContent>
          </Card>
        </Section>
      )}

      <Section>
        <H2Title title="Add-ons" description="Available add-ons" />
        <Card rounded>
          <StyledCardContent>
            <StyledAddonRow>
              <IconSparkles size={16} />
              Dialer + AI Coach
              {addOns.includes('dialer-coach') && (
                <StyledBadge variant="active">active</StyledBadge>
              )}
            </StyledAddonRow>
            <StyledAddonRow>
              <IconRocket size={16} />
              AI Assistant
              {addOns.includes('ai-assistant') && (
                <StyledBadge variant="active">active</StyledBadge>
              )}
            </StyledAddonRow>
          </StyledCardContent>
        </Card>
      </Section>

      <Section>
        <H2Title title="Billing" description="Manage your subscription" />
        <StyledButtonRow>
          {!isSubscribed && (
            <Button
              title="Upgrade Plan"
              variant="primary"
              disabled={actionLoading}
              onClick={() => void handleCheckout()}
            />
          )}
          {data.stripeCustomerId && (
            <Button
              title="Manage Billing"
              variant="secondary"
              disabled={actionLoading}
              onClick={() => void handlePortal()}
            />
          )}
        </StyledButtonRow>
      </Section>
    </>
  );
};
