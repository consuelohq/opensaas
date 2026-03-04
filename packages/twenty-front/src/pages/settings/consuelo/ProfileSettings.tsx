import { SettingsOptionCardContentToggle } from '~/modules/settings/components/SettingsOptions/SettingsOptionCardContentToggle';
import { SettingsOptionCardContentSelect } from '~/modules/settings/components/SettingsOptions/SettingsOptionCardContentSelect';
import { useUserPreferences } from '~/modules/settings/hooks/useUserPreferences';
import type { ProfilePreferences } from '~/modules/settings/types/preferences';
import { Select } from '~/modules/ui/input/components/Select';
import { TextInput } from '@/ui/input/components/TextInput';
import { TextArea } from '@/ui/input/components/TextArea';
import styled from '@emotion/styled';
import { useCallback } from 'react';
import { IconClock, IconMicrophone, IconUser, IconWorld } from '@tabler/icons-react';
import { H2Title } from 'twenty-ui/display';
import { Card, Section } from 'twenty-ui/layout';

const StyledTimeRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
`;

const StyledTimeInput = styled.input`
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
`;

const StyledTimeLabel = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledInputRow = styled.div`
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
`;

const TIMEZONE_OPTIONS = Intl.supportedValuesOf('timeZone').map((tz) => ({
  value: tz,
  label: tz.replace(/_/g, ' '),
}));

export const ProfileSettings = () => {
  const { preferences: prefs, updatePreferences } = useUserPreferences();

  const updateProfile = useCallback(
    (patch: Partial<ProfilePreferences>) => {
      updatePreferences({
        profile: { ...prefs.profile, ...patch },
      });
    },
    [prefs.profile, updatePreferences],
  );

  return (
    <>
      <Section>
        <H2Title
          title="Display Name"
          description="How your name appears to others"
        />
        <Card rounded>
          <StyledInputRow>
            <TextInput
              value={prefs.profile.displayName}
              onChange={(value) => updateProfile({ displayName: value })}
              placeholder="Enter your display name"
              fullWidth
            />
          </StyledInputRow>
        </Card>
      </Section>

      <Section>
        <H2Title
          title="Voicemail Greeting"
          description="Message callers hear when you're unavailable"
        />
        <Card rounded>
          <StyledInputRow>
            <TextArea
              textAreaId="voicemail-greeting"
              value={prefs.profile.voicemailGreeting}
              onChange={(value) => updateProfile({ voicemailGreeting: value })}
              placeholder="Hi, you've reached my voicemail. Please leave a message."
              minRows={3}
            />
          </StyledInputRow>
        </Card>
      </Section>

      <Section>
        <H2Title
          title="Timezone"
          description="Used for scheduling and working hours"
        />
        <Card rounded>
          <SettingsOptionCardContentSelect
            Icon={IconWorld}
            title="Timezone"
            description="Your local timezone"
          >
            <Select
              dropdownId="profile-timezone"
              value={prefs.profile.timezone}
              onChange={(val) => updateProfile({ timezone: val })}
              options={TIMEZONE_OPTIONS}
              selectSizeVariant="small"
              dropdownWidth={280}
            />
          </SettingsOptionCardContentSelect>
        </Card>
      </Section>

      <Section>
        <H2Title
          title="Working Hours"
          description="Set your availability window"
        />
        <Card rounded>
          <SettingsOptionCardContentToggle
            Icon={IconClock}
            title="Enable working hours"
            description="Only receive calls during this window"
            checked={prefs.profile.workingHoursEnabled}
            onChange={(val) => updateProfile({ workingHoursEnabled: val })}
          />
        </Card>
        {prefs.profile.workingHoursEnabled && (
          <StyledTimeRow>
            <StyledTimeLabel>From</StyledTimeLabel>
            <StyledTimeInput
              type="time"
              value={prefs.profile.workingHoursStart}
              onChange={(e) =>
                updateProfile({ workingHoursStart: e.target.value })
              }
            />
            <StyledTimeLabel>to</StyledTimeLabel>
            <StyledTimeInput
              type="time"
              value={prefs.profile.workingHoursEnd}
              onChange={(e) =>
                updateProfile({ workingHoursEnd: e.target.value })
              }
            />
          </StyledTimeRow>
        )}
      </Section>
    </>
  );
};
