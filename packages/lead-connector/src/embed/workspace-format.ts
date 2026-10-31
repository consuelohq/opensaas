import type {
  LeadConnectorEmbedState,
  EmbedAdminCall,
} from './state-machine.js';
import { resolveLeadConnectorContactName } from './contact-label.js';
export const escapeHtml = (v: unknown): string =>
  String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
export const titleCase = (v: string): string =>
  v.replaceAll(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const isOpaqueReference = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v) ||
  (/^[A-Za-z0-9_-]{18,}$/.test(v) && /[0-9]/.test(v));
export const humanName = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() && !isOpaqueReference(value.trim())
    ? value.trim()
    : fallback;
export const formatPhone = (v: unknown): string => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1'))
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return /^\+[1-9]\d{7,14}$/.test(String(v)) ? String(v) : 'Phone number';
};
const planNames: Record<string, string> = {
  single: 'Professional',
  standard: 'Agency',
  power: 'Enterprise',
  professional: 'Professional',
  agency: 'Agency',
  enterprise: 'Enterprise',
};
export const planName = (state: LeadConnectorEmbedState): string =>
  state.commercialCaller?.trial
    ? 'Starter'
    : state.commercialDashboard?.publicPurchase
      ? planNames[state.commercialDashboard.publicPurchase.plan]!
      : state.commercialCaller
        ? (planNames[state.commercialCaller.planCode ?? ''] ?? 'Your plan')
        : 'Loading plan';
export const repName = (
  state: LeadConnectorEmbedState,
  id: unknown,
): string => {
  if (id && id === state.inboundOperator.rep.repId) return 'You';
  const seat = state.commercialDashboard?.seats.find(
    (s) => (s.user_id ?? s.userId) === id,
  );
  return humanName(
    seat?.display_name ?? seat?.displayName ?? seat?.name ?? id,
    'Team member',
  );
};
export const callName = (
  state: LeadConnectorEmbedState,
  call: EmbedAdminCall,
): string => {
  const contact = state.contacts.find(
    (c) => c.id === call.contactId || c.id === call.contactName,
  );
  if (contact) {
    const name = resolveLeadConnectorContactName(contact);
    if (name) return name;
  }
  return humanName(call.contactName, 'Call');
};
export const duration = (seconds?: number | null): string =>
  seconds == null
    ? '—'
    : seconds < 60
      ? `${Math.max(0, Math.floor(seconds))} sec`
      : `${Math.floor(seconds / 60)} min${seconds % 60 ? ' ' + Math.floor(seconds % 60) + ' sec' : ''}`;
export const dateTime = (value?: string | null): string =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Date unavailable';
export const money = (cents: number): string =>
  Number.isFinite(cents)
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(cents / 100)
    : '—';
export const recordValue = (
  v: Record<string, unknown> | null | undefined,
  a: string,
  b: string,
): unknown => v?.[a] ?? v?.[b];
