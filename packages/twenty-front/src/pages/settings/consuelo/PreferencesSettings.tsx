import { SettingsOptionCardContentSelect } from '@/settings/components/SettingsOptions/SettingsOptionCardContentSelect';
import { SettingsOptionCardContentToggle } from '@/settings/components/SettingsOptions/SettingsOptionCardContentToggle';
import { useUserPreferences } from '@/settings/hooks/useUserPreferences';
import { DEFAULT_SHORTCUTS } from '@/settings/types/preferences';
import type {
  DialerPreferences,
  DisplayPreferences,
  KeyboardPreferences,
  NotificationPreferences,
} from '@/settings/types/preferences';
import { Select } from '@/ui/input/components/Select';
import { useColorScheme } from '@/ui/theme/hooks/useColorScheme';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import {
  H2Title,
  IconBell,
  IconBellOff,
  IconClock,
  IconCommand,
  IconDeviceFloppy,
  IconHeadphones,
  IconMicrophone,
  IconMoon,
  IconPhone,
  IconPlayerRecord,
  IconRefresh,
  IconVolume,
} from 'twenty-ui/display';
import { Button, ColorSchemePicker } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';

type PreferencesTab = 'notifications' | 'dialer' | 'display' | 'keyboard';

// -- styled --

const StyledTabBar = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  padding-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledTab = styled.button<{ isActive: boolean }>`
  background: none;
  border: none;
  border-bottom: 2px solid
    ${({ isActive, theme }) => (isActive ? theme.color.blue : 'transparent')};
  color: ${({ isActive, theme }) =>
    isActive ? theme.font.color.primary : theme.font.color.tertiary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledSliderRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
`;

const StyledSlider = styled.input`
  flex: 1;
`;

const StyledSliderLabel = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 36px;
  text-align: right;
`;

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

const StyledPermissionBanner = styled.div<{ variant: 'warning' | 'info' }>`
  align-items: center;
  background: ${({ variant, theme }) =>
    variant === 'warning'
      ? theme.background.danger
      : theme.background.transparent.lighter};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ variant, theme }) =>
    variant === 'warning' ? theme.color.red : theme.font.color.secondary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledShortcutTable = styled.table`
  border-collapse: collapse;
  width: 100%;

  th,
  td {
    border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
    font-size: ${({ theme }) => theme.font.size.sm};
    padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
    text-align: left;
  }

  th {
    color: ${({ theme }) => theme.font.color.tertiary};
    font-weight: ${({ theme }) => theme.font.weight.medium};
  }
`;

const StyledKbd = styled.kbd`
  background: ${({ theme }) => theme.background.transparent.medium};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  color: ${({ theme }) => theme.font.color.primary};
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(1.5)}`};
`;

const StyledRecordInput = styled.input`
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 2px solid ${({ theme }) => theme.color.blue};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  outline: none;
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
  text-align: center;
  width: 140px;
`;

const StyledEditButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(1)};

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledResetRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
`;

// -- helpers --

const formatKeys = (keys: string): string[] => keys.split('+');

const isMac =
  typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

// -- component --

export const PreferencesSettings = () => {
  const [tab, setTab] = useState<PreferencesTab>('notifications');
  const { preferences: prefs, updatePreferences } = useUserPreferences();
  const { colorScheme, setColorScheme } = useColorScheme();
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission>(
      typeof Notification !== 'undefined' ? Notification.permission : 'denied',
    );
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState('');

  const updateNotif = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      updatePreferences({
        notifications: { ...prefs.notifications, ...patch },
      });
    },
    [prefs.notifications, updatePreferences],
  );

  const updateDialer = useCallback(
    (patch: Partial<DialerPreferences>) => {
      updatePreferences({ dialer: { ...prefs.dialer, ...patch } });
    },
    [prefs.dialer, updatePreferences],
  );

  const updateDisplay = useCallback(
    (patch: Partial<DisplayPreferences>) => {
      updatePreferences({ display: { ...prefs.display, ...patch } });
    },
    [prefs.display, updatePreferences],
  );

  const updateKeyboard = useCallback(
    (patch: Partial<KeyboardPreferences>) => {
      updatePreferences({ keyboard: { ...prefs.keyboard, ...patch } });
    },
    [prefs.keyboard, updatePreferences],
  );

  const requestNotifPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      updateNotif({ enableDesktop: true });
    }
  }, [updateNotif]);

  const testNotification = useCallback(() => {
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    )
      return;
    new Notification('Consuelo', {
      body: 'This is how your notifications will appear.',
    });
  }, []);

  const handleShortcutKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push(isMac ? 'Cmd' : 'Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      const key = e.key;
      if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
      }
      if (parts.length > 0) {
        setRecordedKeys(parts.join('+'));
      }
    },
    [],
  );

  const saveShortcut = useCallback(
    (shortcutId: string) => {
      if (!recordedKeys) {
        setEditingShortcut(null);
        return;
      }
      const updated = prefs.keyboard.shortcuts.map((s) =>
        s.id === shortcutId ? { ...s, keys: recordedKeys } : s,
      );
      updateKeyboard({ shortcuts: updated });
      setEditingShortcut(null);
      setRecordedKeys('');
    },
    [recordedKeys, prefs.keyboard.shortcuts, updateKeyboard],
  );

  const resetShortcuts = useCallback(() => {
    updateKeyboard({ shortcuts: DEFAULT_SHORTCUTS });
  }, [updateKeyboard]);

  const tabs: { id: PreferencesTab; label: string }[] = [
    { id: 'notifications', label: 'Notifications' },
    { id: 'dialer', label: 'Dialer' },
    { id: 'display', label: 'Display' },
    { id: 'keyboard', label: 'Keyboard' },
  ];

  return (
    <>
      <StyledTabBar>
        {tabs.map((t) => (
          <StyledTab
            key={t.id}
            isActive={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </StyledTab>
        ))}
      </StyledTabBar>

      {tab === 'notifications' && (
        <>
          {notifPermission === 'denied' && (
            <StyledPermissionBanner variant="warning">
              <IconBellOff size={16} />
              Notifications are blocked. Enable them in your browser settings.
            </StyledPermissionBanner>
          )}
          {notifPermission === 'default' && (
            <Section>
              <StyledPermissionBanner variant="info">
                <IconBell size={16} />
                Enable desktop notifications to stay informed about calls.
              </StyledPermissionBanner>
              <Button
                title="Enable Notifications"
                onClick={requestNotifPermission}
                variant="primary"
              />
            </Section>
          )}

          <Section>
            <H2Title
              title="Desktop Notifications"
              description="Get notified about calls and coaching"
            />
            <Card rounded>
              <SettingsOptionCardContentToggle
                Icon={IconBell}
                title="Desktop notifications"
                description="Show browser notifications"
                checked={prefs.notifications.enableDesktop}
                onChange={(val) => updateNotif({ enableDesktop: val })}
                disabled={notifPermission !== 'granted'}
              />
              <SettingsOptionCardContentToggle
                Icon={IconVolume}
                title="Notification sounds"
                description="Play a sound with notifications"
                checked={prefs.notifications.enableSound}
                onChange={(val) => updateNotif({ enableSound: val })}
              />
            </Card>
            {prefs.notifications.enableSound && (
              <StyledSliderRow>
                <StyledSlider
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={prefs.notifications.soundVolume}
                  onChange={(e) =>
                    updateNotif({ soundVolume: parseFloat(e.target.value) })
                  }
                />
                <StyledSliderLabel>
                  {Math.round(prefs.notifications.soundVolume * 100)}%
                </StyledSliderLabel>
              </StyledSliderRow>
            )}
            {notifPermission === 'granted' && (
              <Button
                title="Test Notification"
                Icon={IconBell}
                onClick={testNotification}
                variant="secondary"
                size="small"
              />
            )}
          </Section>

          <Section>
            <H2Title
              title="Notify Me About"
              description="Choose which events trigger notifications"
            />
            <Card rounded>
              <SettingsOptionCardContentToggle
                Icon={IconPhone}
                title="Incoming calls"
                description="When a call comes in"
                checked={prefs.notifications.notifyOnIncomingCall}
                onChange={(val) =>
                  updateNotif({ notifyOnIncomingCall: val })
                }
              />
              <SettingsOptionCardContentToggle
                Icon={IconPhone}
                title="Missed calls"
                description="When you miss a call"
                checked={prefs.notifications.notifyOnMissedCall}
                onChange={(val) =>
                  updateNotif({ notifyOnMissedCall: val })
                }
              />
              <SettingsOptionCardContentToggle
                Icon={IconMicrophone}
                title="Voicemails"
                description="When a new voicemail arrives"
                checked={prefs.notifications.notifyOnVoicemail}
                onChange={(val) =>
                  updateNotif({ notifyOnVoicemail: val })
                }
              />
              <SettingsOptionCardContentToggle
                Icon={IconHeadphones}
                title="AI coaching suggestions"
                description="When coaching has a suggestion"
                checked={prefs.notifications.notifyOnCoachingSuggestion}
                onChange={(val) =>
                  updateNotif({ notifyOnCoachingSuggestion: val })
                }
              />
            </Card>
          </Section>

          <Section>
            <H2Title
              title="Quiet Hours"
              description="Suppress notifications during off hours"
            />
            <Card rounded>
              <SettingsOptionCardContentToggle
                Icon={IconMoon}
                title="Enable quiet hours"
                description="No notifications during this window"
                checked={prefs.notifications.quietHoursEnabled}
                onChange={(val) =>
                  updateNotif({ quietHoursEnabled: val })
                }
              />
            </Card>
            {prefs.notifications.quietHoursEnabled && (
              <StyledTimeRow>
                <StyledTimeLabel>From</StyledTimeLabel>
                <StyledTimeInput
                  type="time"
                  value={prefs.notifications.quietHoursStart}
                  onChange={(e) =>
                    updateNotif({ quietHoursStart: e.target.value })
                  }
                />
                <StyledTimeLabel>to</StyledTimeLabel>
                <StyledTimeInput
                  type="time"
                  value={prefs.notifications.quietHoursEnd}
                  onChange={(e) =>
                    updateNotif({ quietHoursEnd: e.target.value })
                  }
                />
              </StyledTimeRow>
            )}
          </Section>
        </>
      )}

      {tab === 'dialer' && (
        <>
          <Section>
            <H2Title
              title="Call Behavior"
              description="Defaults for incoming and outgoing calls"
            />
            <Card rounded>
              <SettingsOptionCardContentToggle
                Icon={IconPhone}
                title="Auto-answer incoming calls"
                description="Automatically answer after a delay"
                checked={prefs.dialer.autoAnswer}
                onChange={(val) => updateDialer({ autoAnswer: val })}
              />
            </Card>
            {prefs.dialer.autoAnswer && (
              <Card rounded>
                <SettingsOptionCardContentSelect
                  Icon={IconClock}
                  title="Auto-answer delay"
                  description="Seconds before auto-answering"
                >
                  <Select
                    dropdownId="auto-answer-delay"
                    value={prefs.dialer.autoAnswerDelay}
                    onChange={(val) =>
                      updateDialer({ autoAnswerDelay: val })
                    }
                    options={[
                      { value: 1, label: '1 second' },
                      { value: 2, label: '2 seconds' },
                      { value: 3, label: '3 seconds' },
                      { value: 5, label: '5 seconds' },
                    ]}
                    selectSizeVariant="small"
                    dropdownWidth={160}
                  />
                </SettingsOptionCardContentSelect>
              </Card>
            )}
          </Section>

          <Section>
            <H2Title
              title="Safety"
              description="Prevent accidental actions"
            />
            <Card rounded>
              <SettingsOptionCardContentToggle
                Icon={IconPhone}
                title="Confirm before hanging up"
                description="Show confirmation dialog before ending calls"
                checked={prefs.dialer.confirmBeforeHangup}
                onChange={(val) =>
                  updateDialer({ confirmBeforeHangup: val })
                }
              />
              <SettingsOptionCardContentToggle
                Icon={IconClock}
                title="Show call timer"
                description="Display call duration during active calls"
                checked={prefs.dialer.showCallTimer}
                onChange={(val) => updateDialer({ showCallTimer: val })}
              />
            </Card>
          </Section>

          <Section>
            <H2Title
              title="Recording & Transcription"
              description="Automatic recording and transcription"
            />
            <Card rounded>
              <SettingsOptionCardContentToggle
                Icon={IconPlayerRecord}
                title="Record calls by default"
                description="Automatically start recording on new calls"
                checked={prefs.dialer.recordByDefault}
                onChange={(val) =>
                  updateDialer({ recordByDefault: val })
                }
              />
              <SettingsOptionCardContentToggle
                Icon={IconDeviceFloppy}
                title="Transcribe calls by default"
                description="Automatically transcribe recorded calls"
                checked={prefs.dialer.transcribeByDefault}
                onChange={(val) =>
                  updateDialer({ transcribeByDefault: val })
                }
              />
            </Card>
          </Section>

          <Section>
            <H2Title
              title="Scheduling"
              description="Default values for calendar integration"
            />
            <Card rounded>
              <SettingsOptionCardContentSelect
                Icon={IconClock}
                title="Default call duration"
                description="Used when scheduling calls on calendar"
              >
                <Select
                  dropdownId="default-call-duration"
                  value={prefs.dialer.defaultCallDuration}
                  onChange={(val) =>
                    updateDialer({ defaultCallDuration: val })
                  }
                  options={[
                    { value: 15, label: '15 minutes' },
                    { value: 30, label: '30 minutes' },
                    { value: 45, label: '45 minutes' },
                    { value: 60, label: '1 hour' },
                  ]}
                  selectSizeVariant="small"
                  dropdownWidth={160}
                />
              </SettingsOptionCardContentSelect>
            </Card>
          </Section>
        </>
      )}

      {tab === 'display' && (
        <>
          <Section>
            <H2Title title="Theme" description="Choose your color scheme" />
            <ColorSchemePicker
              value={colorScheme}
              onChange={setColorScheme}
              lightLabel="Light"
              darkLabel="Dark"
              systemLabel="System"
            />
          </Section>

          <Section>
            <H2Title
              title="Layout"
              description="Adjust how the interface looks"
            />
            <Card rounded>
              <SettingsOptionCardContentToggle
                Icon={IconCommand}
                title="Compact mode"
                description="Reduce spacing and show more content"
                checked={prefs.display.compactMode}
                onChange={(val) => updateDisplay({ compactMode: val })}
              />
              <SettingsOptionCardContentToggle
                Icon={IconCommand}
                title="Show contact avatars"
                description="Display profile pictures in lists"
                checked={prefs.display.showAvatars}
                onChange={(val) => updateDisplay({ showAvatars: val })}
              />
            </Card>
          </Section>

          <Section>
            <H2Title
              title="Date & Time"
              description="Format preferences for dates and times"
            />
            <Card rounded>
              <SettingsOptionCardContentSelect
                Icon={IconClock}
                title="Date format"
                description="How dates are displayed"
              >
                <Select
                  dropdownId="date-format"
                  value={prefs.display.dateFormat}
                  onChange={(val) => updateDisplay({ dateFormat: val })}
                  options={[
                    {
                      value: 'MM/DD/YYYY' as const,
                      label: 'MM/DD/YYYY (US)',
                    },
                    {
                      value: 'DD/MM/YYYY' as const,
                      label: 'DD/MM/YYYY (EU)',
                    },
                    {
                      value: 'YYYY-MM-DD' as const,
                      label: 'YYYY-MM-DD (ISO)',
                    },
                  ]}
                  selectSizeVariant="small"
                  dropdownWidth={200}
                />
              </SettingsOptionCardContentSelect>
              <SettingsOptionCardContentSelect
                Icon={IconClock}
                title="Time format"
                description="12-hour or 24-hour clock"
              >
                <Select
                  dropdownId="time-format"
                  value={prefs.display.timeFormat}
                  onChange={(val) => updateDisplay({ timeFormat: val })}
                  options={[
                    { value: '12h' as const, label: '12-hour (1:30 PM)' },
                    { value: '24h' as const, label: '24-hour (13:30)' },
                  ]}
                  selectSizeVariant="small"
                  dropdownWidth={200}
                />
              </SettingsOptionCardContentSelect>
              <SettingsOptionCardContentSelect
                Icon={IconClock}
                title="Timezone"
                description="Your local timezone"
              >
                <Select
                  dropdownId="timezone"
                  value={prefs.display.timezone}
                  onChange={(val) => updateDisplay({ timezone: val })}
                  options={Intl.supportedValuesOf('timeZone').map((tz) => ({
                    value: tz,
                    label: tz.replace(/_/g, ' '),
                  }))}
                  selectSizeVariant="small"
                  dropdownWidth={280}
                />
              </SettingsOptionCardContentSelect>
            </Card>
          </Section>
        </>
      )}

      {tab === 'keyboard' && (
        <>
          <Section>
            <H2Title
              title="Keyboard Shortcuts"
              description="Customize shortcuts for dialer actions. Click a shortcut to re-record it."
            />
            <Card rounded>
              <SettingsOptionCardContentToggle
                Icon={IconCommand}
                title="Enable keyboard shortcuts"
                description="Turn off to disable all custom shortcuts"
                checked={prefs.keyboard.enabled}
                onChange={(val) => updateKeyboard({ enabled: val })}
              />
            </Card>
          </Section>

          {prefs.keyboard.enabled && (
            <Section>
              <Card rounded>
                <StyledShortcutTable>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Shortcut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {prefs.keyboard.shortcuts.map((shortcut) => (
                      <tr key={shortcut.id}>
                        <td>{shortcut.description}</td>
                        <td>
                          {editingShortcut === shortcut.id ? (
                            <StyledRecordInput
                              value={recordedKeys || 'Press keys…'}
                              onKeyDown={handleShortcutKeyDown}
                              onBlur={() => saveShortcut(shortcut.id)}
                              autoFocus
                              readOnly
                            />
                          ) : (
                            <>
                              {formatKeys(shortcut.keys).map((k, i) => (
                                <span key={i}>
                                  {i > 0 && ' + '}
                                  <StyledKbd>{k}</StyledKbd>
                                </span>
                              ))}
                            </>
                          )}
                        </td>
                        <td>
                          {shortcut.customizable &&
                            editingShortcut !== shortcut.id && (
                              <StyledEditButton
                                onClick={() => {
                                  setEditingShortcut(shortcut.id);
                                  setRecordedKeys('');
                                }}
                              >
                                Edit
                              </StyledEditButton>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </StyledShortcutTable>
              </Card>
              <StyledResetRow>
                <Button
                  title="Reset to Defaults"
                  Icon={IconRefresh}
                  onClick={resetShortcuts}
                  variant="secondary"
                  size="small"
                />
              </StyledResetRow>
            </Section>
          )}
        </>
      )}
    </>
  );
};
