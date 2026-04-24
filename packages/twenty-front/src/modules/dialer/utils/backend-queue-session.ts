type BackendQueueSessionEndpoint = 'resume' | 'start' | null;

export const getBackendQueueSessionEndpoint = (
  queueStatus: string | null | undefined,
): BackendQueueSessionEndpoint => {
  if (queueStatus === 'active' || queueStatus === 'completed') {
    return null;
  }

  if (queueStatus === 'paused') {
    return 'resume';
  }

  return 'start';
};
