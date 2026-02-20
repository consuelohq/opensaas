import { SettingsOptionCardContentSelect } from '~/modules/settings/components/SettingsOptions/SettingsOptionCardContentSelect';
import { SettingsOptionCardContentToggle } from '~/modules/settings/components/SettingsOptions/SettingsOptionCardContentToggle';
import { useUserPreferences } from '~/modules/settings/hooks/useUserPreferences';
import type { CallingMode, DialerPreferences } from '~/modules/settings/types/preferences';
import { Select } from '~/modules/ui/input/components/Select';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import {
  IconMapPin,
  IconPhone,
  IconPhoneCall,
  IconSearch,
} from '@tabler/icons-react';
import { H2Title } from 'twenty-ui/display';
import { Button, TextInput } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';

type PreviewResult = {
  selectedNumber: string | null;
  areaCode: string;
  localMatch: boolean;
  proximityMatch: boolean;
  distanceMiles: number | null;
  customerAreaCode: string;
  localPresenceEnabled: boolean;
};

const StyledPreviewRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
`;

const StyledPreviewResult = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
`;

const StyledMatchBadge = styled.span<{ isMatch: boolean }>`
  background: ${({ isMatch, theme }) =>
    isMatch ? theme.color.green : theme.background.transparent.medium};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  color: ${({ isMatch, theme }) =>
    isMatch ? '#fff' : theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(1.5)}`};
`;

const CALLING_MODE_OPTIONS: { value: CallingMode; label: string }[] = [
  { value: 'single', label: 'Single (one call at a time)' },
  { value: 'parallel', label: 'Parallel / Power Dialer' },
];

const PARALLEL_LINES_OPTIONS = [2, 3, 4, 5].map((n) => ({
  value: n,
  label: `${n} lines`,
}));

export const CallingPresenceSettings = () => {
  const { preferences, updatePreferences } = useUserPreferences();
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const updateDialer = useCallback(
    (patch: Partial<DialerPreferences>) => {
      updatePreferences({ dialer: { ...preferences.dialer, ...patch } });
    },
    [preferences.dialer, updatePreferences],
  );

  const handlePreview = useCallback(async () => {
    if (!previewPhone.trim()) return;
    setPreviewLoading(true);
    setPreviewResult(null);

    try {
      const phone = previewPhone.startsWith('+')
        ? previewPhone.trim()
        : `+1${previewPhone.trim().replace(/\D/g, '')}`;

      const res = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/local-presence/preview?phoneNumber=${encodeURIComponent(phone)}&fromNumbers=${encodeURIComponent(phone)}`,
        { credentials: 'include' },
      );

      if (res.ok) {
        const data = (await res.json()) as PreviewResult;
        setPreviewResult(data);
      }
    } catch {
      // preview is best-effort
    } finally {
      setPreviewLoading(false);
    }
  }, [previewPhone]);

  return (
    <>
      <Section>
        <H2Title
          title="Calling Mode"
          description="How outbound calls are placed"
        />
        <Card rounded>
          <SettingsOptionCardContentSelect
            Icon={IconPhoneCall}
            title="Mode"
            description="Single dials one number. Parallel dials multiple, first to answer wins."
          >
            <Select
              dropdownId="calling-mode-select"
              value={preferences.dialer.callingMode}
              onChange={(value) => updateDialer({ callingMode: value })}
              options={CALLING_MODE_OPTIONS}
              selectSizeVariant="small"
              dropdownWidth={260}
            />
          </SettingsOptionCardContentSelect>
        </Card>
        {preferences.dialer.callingMode === 'parallel' && (
          <Card rounded>
            <SettingsOptionCardContentSelect
              Icon={IconPhone}
              title="Max parallel lines"
              description="How many numbers to dial simultaneously"
            >
              <Select
                dropdownId="parallel-lines-select"
                value={preferences.dialer.maxParallelLines}
                onChange={(value) => updateDialer({ maxParallelLines: value })}
                options={PARALLEL_LINES_OPTIONS}
                selectSizeVariant="small"
                dropdownWidth={120}
              />
            </SettingsOptionCardContentSelect>
          </Card>
        )}
      </Section>

      <Section>
        <H2Title
          title="Local Presence"
          description="Use a caller ID with an area code near the recipient to increase answer rates"
        />
        <Card rounded>
          <SettingsOptionCardContentToggle
            Icon={IconMapPin}
            title="Enable local presence"
            description="Automatically select the closest matching caller ID"
            checked={preferences.dialer.localPresenceEnabled}
            onChange={(val) => updateDialer({ localPresenceEnabled: val })}
          />
        </Card>
      </Section>

      {preferences.dialer.localPresenceEnabled && (
        <Section>
          <H2Title
            title="Preview Caller ID"
            description="See which number would be used for a given recipient"
          />
          <Card rounded>
            <StyledPreviewRow>
              <TextInput
                placeholder="+15551234567"
                value={previewPhone}
                onChange={setPreviewPhone}
                fullWidth
              />
              <Button
                title={previewLoading ? 'Checking...' : 'Preview'}
                Icon={IconSearch}
                variant="secondary"
                size="small"
                onClick={handlePreview}
                disabled={previewLoading || !previewPhone.trim()}
              />
            </StyledPreviewRow>
            {previewResult && (
              <StyledPreviewResult>
                <div>
                  Caller ID: <strong>{previewResult.selectedNumber ?? 'None'}</strong>
                  {' '}({previewResult.areaCode})
                </div>
                <div style={{ marginTop: 4 }}>
                  <StyledMatchBadge isMatch={previewResult.localMatch}>
                    {previewResult.localMatch
                      ? 'Exact area code match'
                      : previewResult.proximityMatch
                        ? `Proximity match (~${previewResult.distanceMiles}mi)`
                        : 'Primary fallback'}
                  </StyledMatchBadge>
                </div>
              </StyledPreviewResult>
            )}
          </Card>
        </Section>
      )}
    </>
  );
};
