export type SessionColorTone = {
  dark: string;
  light: string;
};

// The first five dark tones intentionally preserve the established tracing palette.
// Additional tones expand visual separation without making session identity random.
export const SESSION_COLOR_TONES: readonly SessionColorTone[] = [
  { dark: '#c87958', light: '#98543d' },
  { dark: '#b88b4a', light: '#816127' },
  { dark: '#8fa17a', light: '#60724d' },
  { dark: '#b06f8f', light: '#7f4d68' },
  { dark: '#7f9b9a', light: '#4e6e6c' },
  { dark: '#9a86b6', light: '#665485' },
  { dark: '#c07d72', light: '#8b5149' },
  { dark: '#7f9db7', light: '#506b82' },
  { dark: '#a69762', light: '#706534' },
  { dark: '#8ba596', light: '#557769' },
  { dark: '#b7779e', light: '#824c70' },
  { dark: '#9d916f', light: '#6d6144' },
  { dark: '#6f9ca4', light: '#406d75' },
  { dark: '#b58368', light: '#835540' },
  { dark: '#87926b', light: '#59633d' },
  { dark: '#aa9bcb', light: '#685a92' },
  { dark: '#7ea6a0', light: '#44776f' },
  { dark: '#cc927d', light: '#9a5948' },
  { dark: '#9eaeb9', light: '#5e737f' },
  { dark: '#c5a4a0', light: '#8a605d' },
  { dark: '#9eae88', light: '#67784e' },
  { dark: '#b99bb6', light: '#835b81' },
  { dark: '#82a8b8', light: '#4b7288' },
  { dark: '#c1a474', light: '#846838' },
  { dark: '#9ca6c9', light: '#58638c' },
] as const;

export function sessionColorTone(value: string): SessionColorTone | null {
  if (!value || value === 'no-branch') return null;
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return SESSION_COLOR_TONES[hash % SESSION_COLOR_TONES.length] ?? null;
}
