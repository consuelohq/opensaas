export type LeadConnectorSurface = 'admin' | 'overlay';

export const resolveLeadConnectorSurface = (
  pathname: string,
): LeadConnectorSurface => {
  const normalized = pathname.trim().toLowerCase();
  return normalized === '/overlay' || normalized.startsWith('/overlay/')
    ? 'overlay'
    : 'admin';
};
