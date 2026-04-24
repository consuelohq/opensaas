import * as Sentry from '@sentry/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import {
  currentQueueIndexState,
  activeQueueState,
  lastCallOutcomeState,
  queueItemsState,
  queueSessionState,
} from '@/dialer/states/queueState';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { dialingModeState } from '@/dialer/states/dialingModeState';
import { parallelLineCountState } from '@/dialer/states/parallelLineCountState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { useParallelDialer } from '@/dialer/hooks/useParallelDialer';
import { useQueueOperations } from '@/dialer/hooks/useQueueOperations';
import { useTwilioDevice } from '@/dialer/hooks/useTwilioDevice';
import { useTwilioConfigStatus } from '@/dialer/hooks/useTwilioConfigStatus';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { type DialerContact } from '@/dialer/types/dialer';
import {
  DEFAULT_QUEUE_SETTINGS,
  type QueueItem,
  type QueueOutcome,
} from '@/dialer/types/queue';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { getBackendQueueSessionEndpoint } from '@/dialer/utils/backend-queue-session';
import { useUserPreferences } from '@/settings/hooks/useUserPreferences';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

type ListMemberWorkspaceRecord = ObjectRecord & {
  id: string;
  position?: number | null;
  status?: string | null;
  disposition?: string | null;
  person?: {
    id?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    phone?: string | null;
    phones?: unknown;
  } | null;
  personId?: string | null;
  phoneNumber?: unknown;
};

type WrapUpOutcome = 'answered' | 'no-answer';

type BackendQueueItem = {
  id: string;
  contact_id: string;
  position: number;
  status: string;
  attempts?: number | null;
  last_attempt_at?: string | null;
  call_outcome?: string | null;
  skip_reason?: string | null;
  call_duration_seconds?: number | null;
};

type BackendQueue = {
  id: string;
  name: string;
  source_type?: string;
  source_id?: string | null;
  category?: string;
  status: string;
  total_contacts?: number;
  completed_contacts?: number;
  skipped_contacts?: number;
  settings?: Record<string, unknown> | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: BackendQueueItem[];
};

export type OpportunityWrapUpState = {
  listMemberId: string;
  outcome: WrapUpOutcome;
  callSid: string | null;
  duration: number;
};

const extractPhoneNumber = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return (
      value
        .map((entry) => extractPhoneNumber(entry))
        .find((phoneNumber): phoneNumber is string => phoneNumber !== null) ??
      null
    );
  }

  if (value && typeof value === 'object') {
    const recordValue = value as Record<string, unknown>;
    const nestedCandidates = [
      recordValue.primaryPhoneNumber,
      recordValue.phoneNumber,
      recordValue.number,
      recordValue.value,
    ];

    return (
      nestedCandidates
        .map((entry) => extractPhoneNumber(entry))
        .find((phoneNumber): phoneNumber is string => phoneNumber !== null) ??
      null
    );
  }

  return null;
};

const mapDispositionToOutcome = (
  disposition: string | null | undefined,
): QueueOutcome | null => {
  switch (disposition) {
    case 'ANSWERED':
      return 'connected';
    case 'NO_ANSWER':
      return 'no-answer';
    case 'VOICEMAIL':
      return 'voicemail';
    case 'BUSY':
      return 'busy';
    default:
      return null;
  }
};

const mapWrapUpDispositionToListMemberDisposition = (disposition: string) => {
  switch (disposition) {
    case 'voicemail':
      return 'VOICEMAIL';
    case 'busy':
      return 'BUSY';
    case 'no-answer':
      return 'NO_ANSWER';
    default:
      return 'ANSWERED';
  }
};

const mapWrapUpDispositionToQueueOutcome = (
  disposition: string,
): QueueOutcome => {
  switch (disposition) {
    case 'voicemail':
      return 'voicemail';
    case 'busy':
      return 'busy';
    case 'follow-up':
      return 'callback-requested';
    case 'no-answer':
      return 'no-answer';
    case 'not-interested':
      return 'not-interested';
    default:
      return 'connected';
  }
};

const normalizeParallelDialingMaxLines = (
  requestedLineCount: number,
): number => {
  if (Number.isFinite(requestedLineCount) === false) {
    return DEFAULT_QUEUE_SETTINGS.parallelDialingMaxLines;
  }

  if (requestedLineCount <= 2) {
    return 2;
  }

  if (requestedLineCount === 3) {
    return 3;
  }

  return 4;
};

const readQueueBooleanSetting = (
  value: unknown,
  fallbackValue: boolean,
): boolean => {
  return typeof value === 'boolean' ? value : fallbackValue;
};

const readQueueNumberSetting = (
  value: unknown,
  fallbackValue: number,
): number => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallbackValue;
};

const mapBackendOutcomeToQueueOutcome = (
  outcome: string | null | undefined,
): QueueOutcome | null => {
  switch (outcome) {
    case 'connected':
      return 'connected';
    case 'no-answer':
      return 'no-answer';
    case 'voicemail':
      return 'voicemail';
    case 'busy':
      return 'busy';
    case 'wrong-number':
      return 'wrong-number';
    case 'callback-requested':
    case 'follow-up':
      return 'callback-requested';
    case 'not-interested':
      return 'not-interested';
    case 'qualified':
      return 'qualified';
    case 'dnc':
      return 'dnc';
    default:
      return null;
  }
};

const mapBackendStatusToQueueItemStatus = (
  status: string | null | undefined,
): QueueItem['status'] => {
  switch (status) {
    case 'calling':
      return 'calling';
    case 'completed':
      return 'completed';
    case 'skipped':
      return 'skipped';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
};

const mapRecordToDialerContact = (
  record: ListMemberWorkspaceRecord,
  fallbackPhoneNumber: string,
): DialerContact => {
  const nameComposite = record.person?.name as
    | { firstName?: string; lastName?: string }
    | string
    | null
    | undefined;
  const firstName =
    typeof nameComposite === 'object' && nameComposite !== null
      ? (nameComposite.firstName ?? null)
      : null;
  const lastName =
    typeof nameComposite === 'object' && nameComposite !== null
      ? (nameComposite.lastName ?? null)
      : null;
  const name =
    [firstName, lastName].filter(Boolean).join(' ') || fallbackPhoneNumber;

  return {
    id: record.personId ?? record.id,
    name,
    firstName,
    lastName,
    company: record.person?.company ?? null,
    phone: fallbackPhoneNumber,
    email: record.person?.email ?? null,
    avatarUrl: record.person?.avatarUrl ?? null,
  };
};

const getListMemberPhoneNumber = (record: ListMemberWorkspaceRecord) => {
  return (
    extractPhoneNumber(record.phoneNumber) ??
    extractPhoneNumber(record.person?.phones) ??
    extractPhoneNumber(record.person?.phone) ??
    null
  );
};

const QUEUE_LIST_MEMBER_LIMIT = 500;
const queueSessionTransitionsInFlight = new Set<string>();

export const useOpportunityQueueWorkspace = ({
  listId,
}: {
  listId: string;
}) => {
  const listName = useRecoilValue<string | null>(
    recordStoreFamilySelector({ recordId: listId, fieldName: 'name' }),
  );
  const listStatus = useRecoilValue<string | null>(
    recordStoreFamilySelector({ recordId: listId, fieldName: 'listStatus' }),
  );
  const persistedCurrentIndex = useRecoilValue<number | null>(
    recordStoreFamilySelector({ recordId: listId, fieldName: 'currentIndex' }),
  );
  const sessionStartedAt = useRecoilValue<string | null>(
    recordStoreFamilySelector({
      recordId: listId,
      fieldName: 'sessionStartedAt',
    }),
  );

  const selectedCallerId = useRecoilValue(selectedCallerIdState);
  const setSelectedCallerId = useSetRecoilState(selectedCallerIdState);
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const dialingMode = useRecoilValue(dialingModeState);
  const parallelLineCount = useRecoilValue(parallelLineCountState);
  const { preferences } = useUserPreferences();
  const requestedParallelDialingEnabled = dialingMode === 'parallel';
  const requestedParallelDialingMaxLines =
    normalizeParallelDialingMaxLines(parallelLineCount);
  const callState = useRecoilValue(callStateAtom);
  const { updateOneRecord } = useUpdateOneRecord();

  const activeQueue = useRecoilValue(activeQueueState);
  const setActiveQueue = useSetRecoilState(activeQueueState);
  const setQueueItems = useSetRecoilState(queueItemsState);
  const setCurrentQueueIndex = useSetRecoilState(currentQueueIndexState);
  const setQueueSession = useSetRecoilState(queueSessionState);
  const setLastCallOutcome = useSetRecoilState(lastCallOutcomeState);
  const setSelectedContact = useSetRecoilState(selectedContactState);
  const setPhoneNumber = useSetRecoilState(phoneNumberState);
  const setCallState = useSetRecoilState(callStateAtom);

  const { status: twilioConfigStatus } = useTwilioConfigStatus();
  const { connect, disconnect, deviceReady, deviceError } = useTwilioDevice();
  const { startParallelBatch } = useParallelDialer();
  const { recordResult } = useQueueOperations();

  const [wrapUpState, setWrapUpState] = useState<OpportunityWrapUpState | null>(
    null,
  );
  const [backendQueue, setBackendQueue] = useState<BackendQueue | null>(null);

  const listMemberFilter = useMemo(
    () => ({ listId: { eq: listId } }),
    [listId],
  );
  const listMemberRecordGqlFields = useMemo(
    () => ({
      id: true,
      position: true,
      status: true,
      disposition: true,
      personId: true,
      phoneNumber: {
        primaryPhoneNumber: true,
        additionalPhones: {
          number: true,
          label: true,
        },
      },
      person: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        phone: true,
        phones: {
          primaryPhoneNumber: true,
          additionalPhones: {
            number: true,
            label: true,
          },
        },
      },
    }),
    [],
  );

  const { records } = useFindManyRecords<ListMemberWorkspaceRecord>({
    objectNameSingular: 'listMember',
    filter: listMemberFilter,
    limit: QUEUE_LIST_MEMBER_LIMIT,
    recordGqlFields: listMemberRecordGqlFields,
  });
  const { fetchAllRecords } = useLazyFetchAllRecords<ListMemberWorkspaceRecord>(
    {
      objectNameSingular: 'listMember',
      filter: listMemberFilter,
      limit: QUEUE_LIST_MEMBER_LIMIT,
      recordGqlFields: listMemberRecordGqlFields,
    },
  );

  const [allQueueRecords, setAllQueueRecords] = useState<
    ListMemberWorkspaceRecord[] | null
  >(null);

  useEffect(() => {
    let isCancelled = false;

    setAllQueueRecords(null);

    void fetchAllRecords()
      .then((fetchedRecords) => {
        if (isCancelled) {
          return;
        }

        setAllQueueRecords(fetchedRecords as ListMemberWorkspaceRecord[]);
      })
      .catch((error: unknown) => {
        Sentry.captureException(error, {
          extra: { context: 'fetchAllQueueRecords', listId },
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [fetchAllRecords, listId]);

  const listRecords = allQueueRecords ?? records;

  const orderedRecords = useMemo(() => {
    return [...listRecords].sort(
      (left, right) => (left.position ?? 0) - (right.position ?? 0),
    );
  }, [listRecords]);

  const callableRecords = useMemo(() => {
    return orderedRecords.filter(
      (record) => getListMemberPhoneNumber(record) !== null,
    );
  }, [orderedRecords]);

  const backendQueueItemsByContactId = useMemo(() => {
    return new Map(
      (backendQueue?.items ?? []).map((item) => [item.contact_id, item]),
    );
  }, [backendQueue?.items]);

  const updateListRecord = useCallback(
    async (updateOneRecordInput: Record<string, unknown>) => {
      try {
        await updateOneRecord({
          objectNameSingular: 'opportunity',
          idToUpdate: listId,
          updateOneRecordInput,
        });
      } catch (error: unknown) {
        Sentry.captureException(error, {
          extra: { context: 'updateListRecord', listId, updateOneRecordInput },
        });
        throw error;
      }
    },
    [listId, updateOneRecord],
  );

  const persistedCurrentIndexRef = useRef<number | null>(persistedCurrentIndex);

  useEffect(() => {
    persistedCurrentIndexRef.current = persistedCurrentIndex;
  }, [persistedCurrentIndex]);

  const syncCurrentIndexFromContactId = useCallback(
    async (contactId: string | null | undefined) => {
      if (!contactId) {
        return;
      }

      const nextIndex = callableRecords.findIndex(
        (record) => record.id === contactId,
      );

      if (nextIndex < 0 || nextIndex === persistedCurrentIndexRef.current) {
        return;
      }

      await updateListRecord({ currentIndex: nextIndex });
    },
    [callableRecords, updateListRecord],
  );

  const loadBackendQueue = useCallback(async () => {
    try {
      const response = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/api/v1/queues?sourceType=list&sourceId=${encodeURIComponent(listId)}`,
      );

      if (!response.ok) {
        const error = new Error(
          `Queue lookup failed with status ${response.status}`,
        );
        Sentry.captureException(error, {
          extra: { context: 'loadBackendQueue.lookup', listId },
        });
        throw error;
      }

      const queues = (await response.json()) as BackendQueue[];
      const nextQueue = queues[0] ?? null;

      if (!nextQueue) {
        setBackendQueue(null);

        return null;
      }

      const detailResponse = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${nextQueue.id}`,
      );

      if (!detailResponse.ok) {
        const error = new Error(
          `Queue detail lookup failed with status ${detailResponse.status}`,
        );
        Sentry.captureException(error, {
          extra: { context: 'loadBackendQueue.detail', listId },
        });
        throw error;
      }

      const queue = (await detailResponse.json()) as BackendQueue;

      setBackendQueue(queue);

      return queue;
    } catch (error: unknown) {
      Sentry.captureException(error, {
        extra: { context: 'loadBackendQueue', listId },
      });

      return null;
    }
  }, [listId]);

  const ensureBackendQueue = useCallback(async () => {
    try {
      const existingQueue = await loadBackendQueue();

      if (existingQueue) {
        let allListRecords = allQueueRecords;

        if (allListRecords === null) {
          allListRecords =
            (await fetchAllRecords()) as ListMemberWorkspaceRecord[];
          setAllQueueRecords(allListRecords);
        }
        const totalCallableRecords = allListRecords.filter(
          (record) => getListMemberPhoneNumber(record) !== null,
        );

        if (
          existingQueue.status === 'active' ||
          existingQueue.status === 'paused'
        ) {
          return existingQueue;
        }

        const existingQueueSettings = existingQueue.settings ?? {};
        const existingParallelDialingEnabled = readQueueBooleanSetting(
          existingQueueSettings.parallelDialingEnabled,
          false,
        );
        const existingParallelDialingMaxLines = readQueueNumberSetting(
          existingQueueSettings.parallelDialingMaxLines,
          DEFAULT_QUEUE_SETTINGS.parallelDialingMaxLines,
        );

        if (
          existingQueue.total_contacts === totalCallableRecords.length &&
          existingParallelDialingEnabled === requestedParallelDialingEnabled &&
          existingParallelDialingMaxLines === requestedParallelDialingMaxLines
        ) {
          return existingQueue;
        }

        const recreateResponse = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/api/v1/queues`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: listName ?? 'Calling list',
              sourceType: 'list',
              sourceId: listId,
              category: 'custom',
              settings: {
                retryAttemptCap: DEFAULT_QUEUE_SETTINGS.maxAttempts,
                parallelDialingEnabled: requestedParallelDialingEnabled,
                parallelDialingMaxLines: requestedParallelDialingMaxLines,
              },
              contactIds: totalCallableRecords.map((record) => record.id),
            }),
          },
        );

        if (!recreateResponse.ok) {
          const error = new Error(
            `Queue recreation failed with status ${recreateResponse.status}`,
          );
          Sentry.captureException(error, {
            extra: { context: 'ensureBackendQueue.recreate', listId },
          });
          throw error;
        }

        return await loadBackendQueue();
      }

      if (callableRecords.length === 0) {
        return null;
      }

      const response = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/api/v1/queues`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: listName ?? 'Calling list',
            sourceType: 'list',
            sourceId: listId,
            category: 'custom',
            settings: {
              retryAttemptCap: DEFAULT_QUEUE_SETTINGS.maxAttempts,
              parallelDialingEnabled: requestedParallelDialingEnabled,
              parallelDialingMaxLines: requestedParallelDialingMaxLines,
            },
            contactIds: callableRecords.map((record) => record.id),
          }),
        },
      );

      if (!response.ok) {
        const error = new Error(
          `Queue creation failed with status ${response.status}`,
        );
        Sentry.captureException(error, {
          extra: { context: 'ensureBackendQueue.create', listId },
        });
        throw error;
      }

      return await loadBackendQueue();
    } catch (error: unknown) {
      Sentry.captureException(error, {
        extra: { context: 'ensureBackendQueue', listId },
      });
      throw error;
    }
  }, [
    allQueueRecords,
    callableRecords,
    fetchAllRecords,
    listId,
    listName,
    loadBackendQueue,
    requestedParallelDialingEnabled,
    requestedParallelDialingMaxLines,
    setAllQueueRecords,
  ]);

  const hydratedQueueItems = useMemo<QueueItem[]>(() => {
    return orderedRecords.reduce<QueueItem[]>((queueItems, record, index) => {
      const phoneNumber = getListMemberPhoneNumber(record);

      if (!phoneNumber) {
        return queueItems;
      }

      const backendQueueItem = backendQueueItemsByContactId.get(record.id);

      queueItems.push({
        id: record.id,
        queueId: backendQueue?.id ?? listId,
        contactId: record.personId ?? record.id,
        contact: mapRecordToDialerContact(record, phoneNumber),
        position: record.position ?? index,
        status: backendQueueItem
          ? mapBackendStatusToQueueItemStatus(backendQueueItem.status)
          : record.status === 'COMPLETED'
            ? 'completed'
            : record.status === 'SKIPPED'
              ? 'skipped'
              : 'pending',
        attempts: backendQueueItem
          ? Number(backendQueueItem.attempts ?? 0)
          : record.status === 'PENDING'
            ? 0
            : 1,
        lastAttemptAt: backendQueueItem?.last_attempt_at ?? null,
        callOutcome: backendQueueItem
          ? mapBackendOutcomeToQueueOutcome(backendQueueItem.call_outcome)
          : mapDispositionToOutcome(record.disposition),
        notes: backendQueueItem?.skip_reason ?? null,
        skipReason: backendQueueItem?.skip_reason ?? null,
        callDurationSeconds: backendQueueItem?.call_duration_seconds ?? null,
      } satisfies QueueItem);

      return queueItems;
    }, []);
  }, [backendQueue?.id, backendQueueItemsByContactId, listId, orderedRecords]);

  const callingQueueItemIndex = useMemo(() => {
    return hydratedQueueItems.findIndex((item) => item.status === 'calling');
  }, [hydratedQueueItems]);

  const currentQueueIndex = useMemo(() => {
    if (callingQueueItemIndex >= 0) {
      return callingQueueItemIndex;
    }

    return persistedCurrentIndex ?? 0;
  }, [callingQueueItemIndex, persistedCurrentIndex]);

  const currentQueueItem = useMemo(() => {
    if (
      callingQueueItemIndex < 0 &&
      (backendQueue?.status === 'completed' || listStatus === 'COMPLETED')
    ) {
      return null;
    }

    return hydratedQueueItems[currentQueueIndex] ?? null;
  }, [
    backendQueue?.status,
    callingQueueItemIndex,
    currentQueueIndex,
    hydratedQueueItems,
    listStatus,
  ]);

  const hasNextQueueItem = useMemo(() => {
    return hydratedQueueItems[currentQueueIndex + 1] !== undefined;
  }, [currentQueueIndex, hydratedQueueItems]);

  const hasPendingQueueItems = useMemo(() => {
    return hydratedQueueItems.some((item) => item.status === 'pending');
  }, [hydratedQueueItems]);

  const autoStartedItemIdRef = useRef<string | null>(null);
  const previousCallStatusRef = useRef(callState.status);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const queueUsesParallelDialing =
    activeQueue?.parallelDialingEnabled ?? requestedParallelDialingEnabled;
  const queueSessionReady =
    twilioConfigStatus !== null && twilioConfigStatus.configured;
  const queueRunnerReady = queueUsesParallelDialing || deviceReady;

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const startBackendQueueSession = useCallback(async () => {
    if (queueSessionTransitionsInFlight.has(listId) === true) {
      return null;
    }

    queueSessionTransitionsInFlight.add(listId);

    try {
      if (listStatus !== 'ACTIVE') {
        return null;
      }

      const queue = await ensureBackendQueue();

      if (!queue) {
        return null;
      }

      const endpoint = getBackendQueueSessionEndpoint(queue.status);

      if (endpoint === null) {
        setBackendQueue(queue);

        return queue;
      }

      const response = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${queue.id}/${endpoint}`,
        {
          method: 'POST',
        },
      );

      if (!response.ok) {
        const error = new Error(
          `Queue ${endpoint} failed with status ${response.status}`,
        );
        Sentry.captureException(error, {
          extra: { context: 'startBackendQueueSession', endpoint, listId },
        });
        throw error;
      }

      const payload = (await response.json()) as {
        currentItem?: { contact_id?: string | null } | null;
        suppression?: { contactId?: string | null } | null;
      };
      const refreshedQueue = await loadBackendQueue();

      await syncCurrentIndexFromContactId(
        payload.currentItem?.contact_id ?? payload.suppression?.contactId,
      );

      return refreshedQueue;
    } catch (error: unknown) {
      Sentry.captureException(error, {
        extra: { context: 'startBackendQueueSession', listId },
      });
      throw error;
    } finally {
      queueSessionTransitionsInFlight.delete(listId);
    }
  }, [
    ensureBackendQueue,
    listId,
    listStatus,
    loadBackendQueue,
    syncCurrentIndexFromContactId,
  ]);

  const advanceBackendQueueSession = useCallback(
    async (outcome: string) => {
      try {
        if (!backendQueue?.id) {
          return null;
        }

        const response = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${backendQueue.id}/next`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              outcome,
              isHighPriority: false,
              localTimezone: 'America/New_York',
            }),
          },
        );

        if (!response.ok) {
          const error = new Error(
            `Queue next failed with status ${response.status}`,
          );
          Sentry.captureException(error, {
            extra: { context: 'advanceBackendQueueSession', listId, outcome },
          });
          throw error;
        }

        const payload = (await response.json()) as {
          nextItem?: { contact_id?: string | null } | null;
          suppression?: { contactId?: string | null } | null;
          queueCompleted?: boolean;
        };

        await loadBackendQueue();

        if (payload.queueCompleted) {
          await updateListRecord({ listStatus: 'COMPLETED' });

          return payload;
        }

        await syncCurrentIndexFromContactId(
          payload.nextItem?.contact_id ?? payload.suppression?.contactId,
        );

        return payload;
      } catch (error: unknown) {
        Sentry.captureException(error, {
          extra: { context: 'advanceBackendQueueSession', listId, outcome },
        });
        throw error;
      }
    },
    [
      backendQueue?.id,
      listId,
      loadBackendQueue,
      syncCurrentIndexFromContactId,
      updateListRecord,
    ],
  );

  useEffect(() => {
    setActiveQueue({
      id: backendQueue?.id ?? listId,
      name: backendQueue?.name ?? listName ?? 'Calling list',
      description: null,
      sourceType: 'list',
      sourceId: listId,
      totalContacts: backendQueue?.total_contacts ?? callableRecords.length,
      completedContacts:
        backendQueue?.completed_contacts ??
        hydratedQueueItems.filter((item) => item.status === 'completed').length,
      skippedContacts:
        backendQueue?.skipped_contacts ??
        hydratedQueueItems.filter((item) => item.status === 'skipped').length,
      status: backendQueue
        ? backendQueue.status === 'active'
          ? 'active'
          : backendQueue.status === 'paused'
            ? 'paused'
            : backendQueue.status === 'completed'
              ? 'completed'
              : 'idle'
        : listStatus === 'ACTIVE'
          ? 'active'
          : listStatus === 'PAUSED'
            ? 'paused'
            : listStatus === 'COMPLETED'
              ? 'completed'
              : 'idle',
      settings: {
        ...DEFAULT_QUEUE_SETTINGS,
        ...(backendQueue?.settings ?? {}),
        autoAdvance: false,
        parallelDialingEnabled: readQueueBooleanSetting(
          backendQueue?.settings?.parallelDialingEnabled,
          requestedParallelDialingEnabled,
        ),
        parallelDialingMaxLines: readQueueNumberSetting(
          backendQueue?.settings?.parallelDialingMaxLines,
          requestedParallelDialingMaxLines,
        ),
      },
      createdAt: backendQueue?.created_at ?? new Date().toISOString(),
      updatedAt: backendQueue?.updated_at ?? new Date().toISOString(),
      startedAt: backendQueue?.started_at ?? sessionStartedAt,
      completedAt: backendQueue?.completed_at ?? null,
      category: backendQueue?.category === 'all' ? 'all' : 'custom',
      callingMode: 'browser',
      dncFilteredCount: 0,
      parallelDialingEnabled: readQueueBooleanSetting(
        backendQueue?.settings?.parallelDialingEnabled,
        requestedParallelDialingEnabled,
      ),
      parallelDialFromNumbers: [],
      parallelDialingActive: false,
      parallelCurrentBatch: 0,
      parallelGroupId: null,
      parallelActiveCalls: [],
      aggregatedStats: null,
    });
    setQueueItems(hydratedQueueItems);
    setCurrentQueueIndex(currentQueueIndex);
    setQueueSession(
      sessionStartedAt
        ? {
            id: `${listId}-session`,
            queueId: listId,
            startedAt: sessionStartedAt,
            endedAt: null,
            callsMade: hydratedQueueItems.filter(
              (item) => item.status === 'completed',
            ).length,
            callsConnected: hydratedQueueItems.filter(
              (item) => item.callOutcome === 'connected',
            ).length,
            totalTalkTime: 0,
            avgCallDuration: 0,
            outcomeBreakdown: {
              connected: 0,
              'no-answer': 0,
              voicemail: 0,
              busy: 0,
              'wrong-number': 0,
              'callback-requested': 0,
              'not-interested': 0,
              qualified: 0,
              dnc: 0,
            },
          }
        : null,
    );
  }, [
    callableRecords.length,
    currentQueueIndex,
    hydratedQueueItems,
    backendQueue,
    listId,
    listName,
    listStatus,
    sessionStartedAt,
    setActiveQueue,
    setCurrentQueueIndex,
    setQueueItems,
    setQueueSession,
  ]);

  useEffect(() => {
    if (listStatus === 'COMPLETED') {
      return;
    }

    if (backendQueue?.status !== 'completed') {
      return;
    }

    void updateListRecord({ listStatus: 'COMPLETED' });
  }, [backendQueue?.status, listStatus, updateListRecord]);

  useEffect(() => {
    if (listStatus !== 'ACTIVE' || callableRecords.length === 0) {
      return;
    }

    if (!queueSessionReady) {
      return;
    }

    if (backendQueue?.status === 'completed' && !hasPendingQueueItems) {
      return;
    }

    if (backendQueue?.status === 'active') {
      return;
    }

    void startBackendQueueSession().catch((error: unknown) => {
      Sentry.captureException(error, {
        extra: {
          context: 'startBackendQueueSession',
          deviceError,
          deviceReady,
          listId,
          queueUsesParallelDialing,
          twilioConfigured: twilioConfigStatus?.configured ?? false,
          twilioMode: twilioConfigStatus?.mode ?? null,
        },
      });
    });
  }, [
    backendQueue?.status,
    callableRecords.length,
    callingQueueItemIndex,
    deviceError,
    deviceReady,
    hasPendingQueueItems,
    listId,
    listStatus,
    queueSessionReady,
    queueUsesParallelDialing,
    startBackendQueueSession,
    twilioConfigStatus,
  ]);

  const startCurrentQueueItem = useCallback(async () => {
    const localPresenceEnabled = preferences.dialer.localPresenceEnabled;
    const defaultCallerId =
      selectedCallerId ?? availableCallerIds[0]?.phoneNumber ?? null;
    const manualCallerId = localPresenceEnabled ? undefined : defaultCallerId;

    if (
      !deviceReady ||
      twilioConfigStatus === null ||
      !twilioConfigStatus.configured
    ) {
      return;
    }

    if (
      !currentQueueItem ||
      (!localPresenceEnabled && defaultCallerId === null)
    ) {
      return;
    }

    autoStartedItemIdRef.current = currentQueueItem.id;
    processedCallSidRef.current = null;
    setQueueItems((previousQueueItems) =>
      previousQueueItems.map((queueItem) =>
        queueItem.id === currentQueueItem.id
          ? {
              ...queueItem,
              status: 'calling',
              lastAttemptAt:
                queueItem.lastAttemptAt ?? new Date().toISOString(),
            }
          : queueItem,
      ),
    );
    setSelectedContact(currentQueueItem.contact);
    setPhoneNumber(currentQueueItem.contact.phone);

    try {
      const preflightRes = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/voice/preflight`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callerId: manualCallerId,
            to: currentQueueItem.contact.phone,
            localPresence: localPresenceEnabled,
          }),
        },
      );

      if (!preflightRes.ok) {
        throw new Error(`Preflight failed: ${preflightRes.status}`);
      }

      const preflightBody = (await preflightRes.json()) as {
        callerId?: string;
      };
      const resolvedCallerId = preflightBody.callerId ?? manualCallerId;

      if (!resolvedCallerId) {
        throw new Error('No caller ID resolved for queue item');
      }

      setSelectedCallerId(resolvedCallerId);
      setCallState((previousCallState) => ({
        ...previousCallState,
        contact: currentQueueItem.contact,
        fromNumber: resolvedCallerId,
      }));

      await connect({
        To: currentQueueItem.contact.phone,
        From: resolvedCallerId,
      });
    } catch (error: unknown) {
      const failedAt = new Date().toISOString();

      // update the backend-hydrated queue source before releasing the
      // auto-start guard so the same item cannot restart immediately.
      setBackendQueue((previousBackendQueue) =>
        previousBackendQueue
          ? {
              ...previousBackendQueue,
              items: previousBackendQueue.items?.map((backendQueueItem) =>
                backendQueueItem.contact_id === currentQueueItem.id
                  ? {
                      ...backendQueueItem,
                      status: 'failed',
                      last_attempt_at: failedAt,
                    }
                  : backendQueueItem,
              ),
            }
          : previousBackendQueue,
      );
      setQueueItems((previousQueueItems) =>
        previousQueueItems.map((queueItem) =>
          queueItem.id === currentQueueItem.id
            ? {
                ...queueItem,
                status: 'failed',
                lastAttemptAt: failedAt,
              }
            : queueItem,
        ),
      );
      autoStartedItemIdRef.current = null;
      setCallState((previousCallState) => ({
        ...previousCallState,
        contact: currentQueueItem.contact,
        fromNumber: manualCallerId ?? null,
        callSid: null,
        duration: 0,
        startedAt: null,
        status: 'failed',
      }));
      Sentry.captureException(error, {
        extra: {
          context: 'startCurrentQueueItem',
          currentQueueItemId: currentQueueItem.id,
          deviceError,
          deviceReady,
          listId,
          localPresenceEnabled,
          twilioConfigured: twilioConfigStatus?.configured ?? false,
          twilioMode: twilioConfigStatus?.mode ?? null,
        },
      });
    }
  }, [
    availableCallerIds,
    connect,
    currentQueueItem,
    deviceError,
    deviceReady,
    listId,
    preferences.dialer.localPresenceEnabled,
    selectedCallerId,
    setCallState,
    setPhoneNumber,
    setSelectedCallerId,
    setSelectedContact,
    twilioConfigStatus,
  ]);

  useEffect(() => {
    if (
      listStatus !== 'ACTIVE' ||
      !queueRunnerReady ||
      !['idle', 'ended', 'failed'].includes(callState.status) ||
      !currentQueueItem ||
      currentQueueItem.status !== 'calling' ||
      autoStartedItemIdRef.current === currentQueueItem.id
    ) {
      return;
    }

    if (queueUsesParallelDialing) {
      autoStartedItemIdRef.current = currentQueueItem.id;
      void startParallelBatch();
      return;
    }

    void startCurrentQueueItem();
  }, [
    callState.status,
    currentQueueItem,
    listStatus,
    queueRunnerReady,
    queueUsesParallelDialing,
    startCurrentQueueItem,
    startParallelBatch,
  ]);

  const processedCallSidRef = useRef<string | null>(null);

  useEffect(() => {
    const previousCallStatus = previousCallStatusRef.current;
    previousCallStatusRef.current = callState.status;

    if (callState.status !== 'ended' || !currentQueueItem) {
      return;
    }

    // Guard: only process each call end once
    const callSid = callState.callSid ?? currentQueueItem.id;
    if (processedCallSidRef.current === callSid) {
      return;
    }
    processedCallSidRef.current = callSid;

    clearAutoAdvanceTimer();

    const outcome: WrapUpOutcome =
      previousCallStatus === 'active' ? 'answered' : 'no-answer';

    setWrapUpState({
      listMemberId: currentQueueItem.id,
      outcome,
      callSid: callState.callSid,
      duration: callState.duration,
    });

    if (outcome === 'no-answer') {
      setLastCallOutcome('no-answer');

      void recordResult(currentQueueItem.id, {
        disposition: 'NO_ANSWER',
        callSid: callState.callSid ?? '',
        duration: callState.duration,
      });

      autoAdvanceTimerRef.current = setTimeout(() => {
        void advanceBackendQueueSession('no-answer');
        setWrapUpState(null);
        autoStartedItemIdRef.current = null;
      }, 1200);
      return;
    }

    setLastCallOutcome('connected');
  }, [
    advanceBackendQueueSession,
    callState.callSid,
    callState.duration,
    callState.status,
    clearAutoAdvanceTimer,
    currentQueueItem,
    recordResult,
    setLastCallOutcome,
  ]);

  const saveDisposition = useCallback(
    async (disposition: string) => {
      if (!wrapUpState?.callSid) {
        return;
      }

      try {
        const response = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/calls/${wrapUpState.callSid}/disposition`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome: disposition }),
          },
        );

        if (!response.ok) {
          const err = new Error(
            `Disposition request failed with status ${response.status}`,
          );
          Sentry.captureException(err);
          throw err;
        }
      } catch (err: unknown) {
        Sentry.captureException(err);
        throw err;
      }
    },
    [wrapUpState?.callSid],
  );

  const continueList = useCallback(
    async (disposition: string) => {
      if (!wrapUpState) {
        return;
      }

      try {
        await saveDisposition(disposition);
        await recordResult(wrapUpState.listMemberId, {
          disposition: mapWrapUpDispositionToListMemberDisposition(disposition),
          callSid: wrapUpState.callSid ?? '',
          duration: wrapUpState.duration,
        });
        const queueOutcome = mapWrapUpDispositionToQueueOutcome(disposition);
        setLastCallOutcome(queueOutcome);
        setWrapUpState(null);
        autoStartedItemIdRef.current = null;
        await advanceBackendQueueSession(disposition);
      } catch (error: unknown) {
        Sentry.captureException(error, {
          extra: { context: 'continueList', disposition, listId },
        });
      }
    },
    [
      advanceBackendQueueSession,
      listId,
      recordResult,
      saveDisposition,
      setLastCallOutcome,
      wrapUpState,
    ],
  );

  const endList = useCallback(
    async (disposition: string) => {
      if (!wrapUpState) {
        return;
      }

      try {
        await saveDisposition(disposition);
        await recordResult(wrapUpState.listMemberId, {
          disposition: mapWrapUpDispositionToListMemberDisposition(disposition),
          callSid: wrapUpState.callSid ?? '',
          duration: wrapUpState.duration,
        });
        const queueOutcome = mapWrapUpDispositionToQueueOutcome(disposition);
        setLastCallOutcome(queueOutcome);
        setWrapUpState(null);
        autoStartedItemIdRef.current = null;
        await updateListRecord({ listStatus: 'COMPLETED' });
      } catch (error: unknown) {
        Sentry.captureException(error, {
          extra: { context: 'endList', disposition, listId },
        });
      }
    },
    [
      listId,
      recordResult,
      saveDisposition,
      setLastCallOutcome,
      updateListRecord,
      wrapUpState,
    ],
  );

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  const pauseList = useCallback(async () => {
    try {
      if (!backendQueue?.id) {
        await updateListRecord({ listStatus: 'PAUSED' });

        return;
      }

      const response = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${backendQueue.id}/pause`,
        { method: 'POST' },
      );

      if (!response.ok) {
        const error = new Error(
          `Queue pause failed with status ${response.status}`,
        );
        Sentry.captureException(error, {
          extra: { context: 'pauseList', listId },
        });
        throw error;
      }

      await loadBackendQueue();
      await updateListRecord({ listStatus: 'PAUSED' });
      autoStartedItemIdRef.current = null;
    } catch (error: unknown) {
      Sentry.captureException(error, {
        extra: { context: 'pauseList', listId },
      });
      throw error;
    }
  }, [backendQueue?.id, listId, loadBackendQueue, updateListRecord]);

  const resumeList = useCallback(async () => {
    try {
      await updateListRecord({ listStatus: 'ACTIVE' });
      autoStartedItemIdRef.current = null;
    } catch (error: unknown) {
      Sentry.captureException(error, {
        extra: { context: 'resumeList', listId },
      });
      throw error;
    }
  }, [listId, updateListRecord]);

  const skipCurrentListMember = useCallback(
    async (reason: string) => {
      try {
        if (!backendQueue?.id || !currentQueueItem) {
          return;
        }

        disconnect();

        const response = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${backendQueue.id}/skip`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          },
        );

        if (!response.ok) {
          const error = new Error(
            `Queue skip failed with status ${response.status}`,
          );
          Sentry.captureException(error, {
            extra: { context: 'skipCurrentListMember', listId, reason },
          });
          throw error;
        }

        const payload = (await response.json()) as {
          skipped?: boolean;
          nextItem?: { contact_id?: string | null } | null;
          suppression?: { contactId?: string | null } | null;
        };

        if (payload.skipped !== false) {
          await updateOneRecord({
            objectNameSingular: 'listMember',
            idToUpdate: currentQueueItem.id,
            updateOneRecordInput: {
              status: 'SKIPPED',
              callSid: callState.callSid ?? '',
              duration: callState.duration,
              attemptedAt: new Date().toISOString(),
            },
          });
        }
        await loadBackendQueue();
        await syncCurrentIndexFromContactId(
          payload.nextItem?.contact_id ?? payload.suppression?.contactId,
        );
        autoStartedItemIdRef.current = null;
      } catch (error: unknown) {
        Sentry.captureException(error, {
          extra: { context: 'skipCurrentListMember', listId, reason },
        });
        throw error;
      }
    },
    [
      backendQueue?.id,
      callState.callSid,
      callState.duration,
      currentQueueItem,
      disconnect,
      listId,
      loadBackendQueue,
      syncCurrentIndexFromContactId,
      updateOneRecord,
    ],
  );

  const restartList = useCallback(async () => {
    try {
      if (backendQueue?.id) {
        const response = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${backendQueue.id}/restart`,
          { method: 'POST' },
        );

        if (!response.ok) {
          const error = new Error(
            `Queue restart failed with status ${response.status}`,
          );
          Sentry.captureException(error, {
            extra: { context: 'restartList', listId },
          });
          throw error;
        }
      }

      await Promise.all(
        callableRecords.map((record) =>
          updateOneRecord({
            objectNameSingular: 'listMember',
            idToUpdate: record.id,
            updateOneRecordInput: {
              status: 'PENDING',
              disposition: null,
              duration: null,
              callSid: null,
              attemptedAt: null,
            },
          }),
        ),
      );
      await updateListRecord({ listStatus: 'IDLE', currentIndex: 0 });
      await loadBackendQueue();
      autoStartedItemIdRef.current = null;
    } catch (error: unknown) {
      Sentry.captureException(error, {
        extra: { context: 'restartList', listId },
      });
      throw error;
    }
  }, [
    backendQueue?.id,
    callableRecords,
    listId,
    loadBackendQueue,
    updateListRecord,
    updateOneRecord,
  ]);

  return {
    wrapUpState,
    currentQueueItem,
    continueList,
    endList,
    pauseList,
    resumeList,
    skipCurrentListMember,
    restartList,
  };
};
