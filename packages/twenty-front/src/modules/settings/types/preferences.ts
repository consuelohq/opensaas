export type NotificationPreferences = {
  enableDesktop: boolean;
  enableSound: boolean;
  soundVolume: number;
  notifyOnIncomingCall: boolean;
  notifyOnMissedCall: boolean;
  notifyOnVoicemail: boolean;
  notifyOnCoachingSuggestion: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "08:00"
};

export type DialerPreferences = {
  autoAnswer: boolean;
  autoAnswerDelay: number; // seconds
  confirmBeforeHangup: boolean;
  defaultCallDuration: number; // minutes, for scheduling
  showCallTimer: boolean;
  recordByDefault: boolean;
  transcribeByDefault: boolean;
};

export type DisplayPreferences = {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  showAvatars: boolean;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  timezone: string;
};

export type KeyboardShortcut = {
  id: string;
  action: string;
  description: string;
  keys: string; // "Cmd+Shift+C"
  customizable: boolean;
};

export type KeyboardPreferences = {
  enabled: boolean;
  shortcuts: KeyboardShortcut[];
};

export type UserPreferences = {
  notifications: NotificationPreferences;
  dialer: DialerPreferences;
  display: DisplayPreferences;
  keyboard: KeyboardPreferences;
};

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { id: 'toggle-sidebar', action: 'toggleDialer', description: 'Toggle dialer sidebar', keys: 'Cmd+D', customizable: true },
  { id: 'mute', action: 'toggleMute', description: 'Toggle mute', keys: 'M', customizable: true },
  { id: 'hold', action: 'toggleHold', description: 'Toggle hold', keys: 'H', customizable: true },
  { id: 'transfer', action: 'openTransfer', description: 'Open transfer dialog', keys: 'T', customizable: true },
  { id: 'end-call', action: 'endCall', description: 'End call / close modal', keys: 'Escape', customizable: false },
  { id: 'call-contact', action: 'callContact', description: 'Call selected contact', keys: 'Cmd+Shift+C', customizable: true },
  { id: 'calling-mode', action: 'toggleCallingMode', description: 'Toggle calling mode', keys: 'Cmd+Shift+M', customizable: true },
  { id: 'search', action: 'commandMenu', description: 'Command menu', keys: 'Cmd+K', customizable: false },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  notifications: {
    enableDesktop: false,
    enableSound: true,
    soundVolume: 0.7,
    notifyOnIncomingCall: true,
    notifyOnMissedCall: true,
    notifyOnVoicemail: true,
    notifyOnCoachingSuggestion: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  },
  dialer: {
    autoAnswer: false,
    autoAnswerDelay: 3,
    confirmBeforeHangup: true,
    showCallTimer: true,
    recordByDefault: false,
    transcribeByDefault: false,
    defaultCallDuration: 30,
  },
  display: {
    theme: 'system',
    compactMode: false,
    showAvatars: true,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  keyboard: {
    enabled: true,
    shortcuts: DEFAULT_SHORTCUTS,
  },
};

export const PREFERENCES_STORAGE_KEY = 'consuelo_preferences';
