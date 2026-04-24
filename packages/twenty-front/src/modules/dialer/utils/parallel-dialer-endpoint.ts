const PARALLEL_DIALER_API_PATH = '/api/v1/calls/parallel';

export const getParallelDialerEndpoint = (
  serverBaseUrl: string,
  suffix = '',
): string => {
  const normalizedBaseUrl = serverBaseUrl.replace(/\/$/, '');
  const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;

  if (suffix.length === 0) {
    return `${normalizedBaseUrl}${PARALLEL_DIALER_API_PATH}`;
  }

  return `${normalizedBaseUrl}${PARALLEL_DIALER_API_PATH}${normalizedSuffix}`;
};
