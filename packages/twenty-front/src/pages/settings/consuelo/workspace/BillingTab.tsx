import styled from '@emotion/styled';
import { Section } from '@/ui/layout/section/components/Section';
import { H2Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import type { BillingInfo, WorkspaceLimits } from '@/settings/types/workspace';

const StyledPlanRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledPlanBadge = styled.span<{ plan: string }>`
  padding: 4px 12px;
  border-radius: 12px;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  text-transform: capitalize;
  background: ${({ plan, theme }) =>
    plan === 'enterprise' ? theme.color.blue + '20' :
    plan === 'team' ? theme.color.green + '20' :
    plan === 'pro' ? theme.color.yellow + '20' : theme.background.tertiary};
  color: ${({ plan, theme }) =>
    plan === 'enterprise' ? theme.color.blue :
    plan === 'team' ? theme.color.green :
    plan === 'pro' ? theme.color.yellow : theme.font.color.secondary};
`;

const StyledStatusBadge = styled.span<{ status: string }>`
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  background: ${({ status, theme }) =>
    status === 'active' ? theme.color.green + '20' :
    status === 'past_due' ? theme.color.red + '20' :
    status === 'trialing' ? theme.color.blue + '20' : theme.background.tertiary};
  color: ${({ status, theme }) =>
    status === 'active' ? theme.color.green :
    status === 'past_due' ? theme.color.red :
    status === 'trialing' ? theme.color.blue : theme.font.color.secondary};
`;

const StyledWarning = styled.div`
  background: ${({ theme }) => theme.color.red}15;
  border: 1px solid ${({ theme }) => theme.color.red};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(3)};
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledMeterRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledMeterLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledMeterBar = styled.div`
  height: 8px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 4px;
  overflow: hidden;
`;

const StyledMeterFill = styled.div<{ percent: number; warn: boolean }>`
  height: 100%;
  width: ${({ percent }) => Math.min(percent, 100)}%;
  background: ${({ warn, theme }) => (warn ? theme.color.red : theme.color.blue)};
  border-radius: 4px;
`;

const StyledFeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledFeature = styled.li`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  &::before {
    content: '✓ ';
    color: ${({ theme }) => theme.color.green};
  }
`;

const StyledPeriod = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

type Props = {
  billing: BillingInfo;
  limits: WorkspaceLimits;
  onManageBilling: () => Promise<void>;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const Meter = ({ label, used, limit }: { label: string; used: number; limit: number; }) => {
  const percent = limit > 0 ? (used / limit) * 100 : 0;
  const isBytes = label.toLowerCase().includes('storage');
  const fmt = isBytes ? formatBytes : (n: number) => n.toLocaleString();
  return (
    <StyledMeterRow>
      <StyledMeterLabel>
        <span>{label}</span>
        <span>{fmt(used)} / {fmt(limit)}</span>
      </StyledMeterLabel>
      <StyledMeterBar>
        <StyledMeterFill percent={percent} warn={percent > 90} />
      </StyledMeterBar>
    </StyledMeterRow>
  );
};

export const BillingTab = ({ billing, limits, onManageBilling }: Props) => {
  const periodEnd = new Date(billing.currentPeriodEnd).toLocaleDateString();

  return (
    <>
      {billing.status === 'past_due' && (
        <StyledWarning>
          Your payment is past due. Please update your billing information to avoid service interruption.
        </StyledWarning>
      )}
      <Section>
        <H2Title title="Plan" description="Current subscription" />
        <StyledPlanRow>
          <StyledPlanBadge plan={billing.plan}>{billing.plan}</StyledPlanBadge>
          <StyledStatusBadge status={billing.status}>{billing.status.replace('_', ' ')}</StyledStatusBadge>
        </StyledPlanRow>
        <StyledPeriod>Current period ends {periodEnd}</StyledPeriod>
      </Section>
      <Section>
        <H2Title title="Usage" description="Current billing period" />
        <Meter label="Seats" used={billing.seats.used} limit={billing.seats.limit} />
        <Meter label="Calls" used={billing.usage.calls.used} limit={billing.usage.calls.limit} />
        <Meter label="Minutes" used={billing.usage.minutes.used} limit={billing.usage.minutes.limit} />
        <Meter label="Storage" used={billing.usage.storage.used} limit={billing.usage.storage.limit} />
      </Section>
      <Section>
        <H2Title title="Features" description="Included in your plan" />
        <StyledFeatureList>
          {limits.features.map((f) => (
            <StyledFeature key={f}>{f}</StyledFeature>
          ))}
        </StyledFeatureList>
      </Section>
      <Section>
        <H2Title title="Manage subscription" />
        <Button title="Manage billing" onClick={onManageBilling} variant="secondary" />
        {billing.plan === 'free' && (
          <Button title="Upgrade" variant="primary" style={{ marginLeft: 8 }} />
        )}
      </Section>
    </>
  );
};
