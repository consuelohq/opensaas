import { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  IconCheck,
  IconClock,
  IconKey,
  IconPhone,
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
type NumberPackSize = 5 | 10 | 50;
type BillingInterval = 'month' | 'year';

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

type NumberPackStatusResponse = {
  packs: {
    5: { count: number; subscriptionIds: string[] };
    10: { count: number; subscriptionIds: string[] };
    50: { count: number; subscriptionIds: string[] };
  };
  totalPackSlots: number;
  canPurchase: boolean;
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

const StyledPackRow = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: space-between;
  padding: ${({ theme }) => `${theme.spacing(2)} 0`};
`;

const StyledPackSelector = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
`;

function badgeVariant(status: PlanStatus): 'trial' | 'active' | 'error' {
  if (status === 'active') return 'active';
  if (status === 'past_due' || status === 'canceled') return 'error';
  return 'trial';
}

export const SubscriptionSettings = () => {
  const [data, setData] = useState<SubscriptionStatusResponse | null>(null);
  const [packData, setPackData] = useState<NumberPackStatusResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPackSize, setSelectedPackSize] = useState<NumberPackSize>(5);
  const [selectedInterval, setSelectedInterval] =
    useState<BillingInterval>('month');

  const fetchStatus = useCallback(async () => {
    try {
      const [subRes, packRes] = await Promise.all([
        authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/subscription/status`,
        ),
        authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/number-packs/status`,
        ),
      ]);
      if (subRes.ok) {
        setData((await subRes.json()) as SubscriptionStatusResponse);
      }
      if (packRes.ok) {
        setPackData((await packRes.json()) as NumberPackStatusResponse);
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
            successUrl: `${window.location.origin}/settings/dialer/subscription?success=true`,
            cancelUrl: `${window.location.origin}/settings/dialer/subscription`,
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
            returnUrl: `${window.location.origin}/settings/dialer/subscription`,
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

  const handlePackCheckout = useCallback(async () => {
    setActionLoading(true);
    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/number-packs/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packSize: selectedPackSize,
            billingInterval: selectedInterval,
            successUrl: `${window.location.origin}/settings/dialer/subscription?pack_success=true`,
            cancelUrl: `${window.location.origin}/settings/dialer/subscription`,
          }),
        },
      );
      const result = (await res.json()) as {
        url?: string;
        error?: { message: string };
      };
      if (result.url) {
        window.location.href = result.url;
      } else if (result.error) {
        console.error('Pack checkout error:', result.error.message);
      }
    } catch (err: unknown) {
      captureException(err);
    } finally {
      setActionLoading(false);
    }
  }, [selectedPackSize, selectedInterval]);

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
  const canPurchasePacks = packData?.canPurchase ?? false;

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
                        warn={usage.aiTokens.used / usage.aiTokens.limit > 0.9}
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
        <H2Title
          title="Number Packs"
          description="Additional phone number slots"
        />
        <Card rounded>
          <StyledCardContent>
            <StyledPackRow>
              <span>
                <IconPhone size={16} style={{ marginRight: 8 }} />5 Number Pack
              </span>
              {packData && packData.packs[5].count > 0 && (
                <StyledBadge variant="active">
                  {packData.packs[5].count} active
                </StyledBadge>
              )}
            </StyledPackRow>
            <StyledPackRow>
              <span>
                <IconPhone size={16} style={{ marginRight: 8 }} />
                10 Number Pack
              </span>
              {packData && packData.packs[10].count > 0 && (
                <StyledBadge variant="active">
                  {packData.packs[10].count} active
                </StyledBadge>
              )}
            </StyledPackRow>
            <StyledPackRow>
              <span>
                <IconPhone size={16} style={{ marginRight: 8 }} />
                50 Number Pack
              </span>
              {packData && packData.packs[50].count > 0 && (
                <StyledBadge variant="active">
                  {packData.packs[50].count} active
                </StyledBadge>
              )}
            </StyledPackRow>

            {packData && packData.totalPackSlots > 0 && (
              <StyledHint>
                Total pack slots: {packData.totalPackSlots} numbers
              </StyledHint>
            )}

            <StyledPackSelector>
              <StyledSelect
                value={selectedPackSize}
                onChange={(e) =>
                  setSelectedPackSize(Number(e.target.value) as NumberPackSize)
                }
              >
                <option value={5}>5 Numbers</option>
                <option value={10}>10 Numbers</option>
                <option value={50}>50 Numbers</option>
              </StyledSelect>
              <StyledSelect
                value={selectedInterval}
                onChange={(e) =>
                  setSelectedInterval(e.target.value as BillingInterval)
                }
              >
                <option value="month">Monthly</option>
                <option value="year">Annual</option>
              </StyledSelect>
            </StyledPackSelector>

            {canPurchasePacks ? (
              <Button
                title="Buy Pack"
                variant="primary"
                disabled={actionLoading}
                onClick={() => void handlePackCheckout()}
              />
            ) : (
              <StyledHint>Upgrade your plan to buy number packs</StyledHint>
            )}
          </StyledCardContent>
        </Card>
      </Section>

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
