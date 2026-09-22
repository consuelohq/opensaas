export type LeadConnectorSurface = 'admin' | 'overlay' | 'customer';

export const resolveLeadConnectorSurface = (
  pathname: string,
): LeadConnectorSurface => {
  const normalized = pathname.trim().toLowerCase();
  if (normalized === '/overlay' || normalized.startsWith('/overlay/'))
    return 'overlay';
  if (normalized.startsWith('/call/')) return 'customer';
  return 'admin';
};
