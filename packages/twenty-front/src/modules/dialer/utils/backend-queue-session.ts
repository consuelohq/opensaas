type BackendQueueSessionEndpoint = 'resume' | 'start' | null;

type QueueContactRecord = {
  id: string;
  personId?: string | null;
};

export const getBackendQueueContactId = (record: QueueContactRecord) => {
  return record.personId ?? record.id;
};

export const isBackendQueueContactIdMatch = (
  record: QueueContactRecord,
  contactId: string | null | undefined,
) => {
  return contactId === getBackendQueueContactId(record);
};

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
