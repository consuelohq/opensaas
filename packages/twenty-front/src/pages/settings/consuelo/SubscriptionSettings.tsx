import styled from '@emotion/styled';
import { IconClock, IconRocket, IconSparkles } from '@tabler/icons-react';
import { H2Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';

const TRIAL_LIMIT_MINUTES = 60;
const SUBSCRIBED_DAILY_LIMIT_MINUTES = 120;

// hardcoded trial state — replace with API data when subscription routes exist
const MOCK_PLAN = {
  name: 'Free Trial',
  status: 'trialing' as const,
  minutesUsed: 0,
  isSubscribed: false,
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

const StyledBadge = styled.span<{ variant: 'trial' | 'active' }>`
  background: ${({ variant, theme }) =>
    variant === 'active' ? theme.color.green + '20' : theme.color.blue + '20'};
  border-radius: 12px;
  color: ${({ variant, theme }) =>
    variant === 'active' ? theme.color.green : theme.color.blue};
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

export const SubscriptionSettings = () => {
  const { name, status, minutesUsed, isSubscribed } = MOCK_PLAN;
  const limit = isSubscribed
    ? SUBSCRIBED_DAILY_LIMIT_MINUTES
    : TRIAL_LIMIT_MINUTES;
  const percent = limit > 0 ? (minutesUsed / limit) * 100 : 0;
  const limitLabel = isSubscribed ? `${limit} min / day` : `${limit} min total`;

  return (
    <>
      <Section>
        <H2Title title="Current Plan" description="Your dialer subscription" />
        <Card rounded>
          <StyledCardContent>
            <StyledPlanRow>
              <StyledPlanName>{name}</StyledPlanName>
              <StyledBadge
                variant={status === 'trialing' ? 'trial' : 'active'}
              >
                {status === 'trialing' ? 'trial' : 'active'}
              </StyledBadge>
            </StyledPlanRow>
            <div>
              <StyledMeterLabel>
                <span>
                  <IconClock size={14} style={{ marginRight: 4 }} />
                  Minutes used
                </span>
                <span>
                  {minutesUsed} / {limitLabel}
                </span>
              </StyledMeterLabel>
              <StyledMeterTrack>
                <StyledMeterFill percent={percent} warn={percent > 90} />
              </StyledMeterTrack>
            </div>
            {!isSubscribed && (
              <StyledHint>
                Trial includes {TRIAL_LIMIT_MINUTES} minutes of total calling
                time. Upgrade for {SUBSCRIBED_DAILY_LIMIT_MINUTES} min/day.
              </StyledHint>
            )}
          </StyledCardContent>
        </Card>
      </Section>

      <Section>
        <H2Title title="Add-ons" description="Available add-ons for your plan" />
        <Card rounded>
          <StyledCardContent>
            <StyledAddonRow>
              <IconSparkles size={16} />
              AI Coaching — real-time call coaching and post-call analysis
            </StyledAddonRow>
            <StyledAddonRow>
              <IconRocket size={16} />
              Parallel Dialing — dial up to 3 numbers simultaneously
            </StyledAddonRow>
            <StyledHint>Add-on management coming soon</StyledHint>
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
              disabled
              onClick={() => {
                // TODO: DEV-750 — open stripe checkout when subscription routes exist
              }}
            />
          )}
          <Button
            title="Manage Billing"
            variant="secondary"
            disabled
            onClick={() => {
              // TODO: DEV-750 — open stripe customer portal when subscription routes exist
            }}
          />
        </StyledButtonRow>
        <StyledHint style={{ marginTop: 8 }}>
          Subscription management coming soon
        </StyledHint>
      </Section>
    </>
  );
};
