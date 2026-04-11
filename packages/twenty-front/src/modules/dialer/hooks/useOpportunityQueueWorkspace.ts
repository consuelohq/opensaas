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
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { useQueueOperations } from '@/dialer/hooks/useQueueOperations';
import { useTwilioDevice } from '@/dialer/hooks/useTwilioDevice';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { type DialerContact } from '@/dialer/types/dialer';
import {
  DEFAULT_QUEUE_SETTINGS,
  type QueueItem,
  type QueueOutcome,
} from '@/dialer/types/queue';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
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
): DialerContact => ({
  id: record.personId ?? record.id,
  name: record.person?.name ?? fallbackPhoneNumber,
  firstName: record.person?.firstName ?? null,
  lastName: record.person?.lastName ?? null,
  company: record.person?.company ?? null,
  phone: fallbackPhoneNumber,
  email: record.person?.email ?? null,
  avatarUrl: record.person?.avatarUrl ?? null,
});

const getListMemberPhoneNumber = (record: ListMemberWorkspaceRecord) => {
  return (
    extractPhoneNumber(record.phoneNumber) ??
    extractPhoneNumber(record.person?.phones) ??
    extractPhoneNumber(record.person?.phone) ??
    null
  );
};

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
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const callState = useRecoilValue(callStateAtom);
  const { updateOneRecord } = useUpdateOneRecord();

  const setActiveQueue = useSetRecoilState(activeQueueState);
  const setQueueItems = useSetRecoilState(queueItemsState);
  const setCurrentQueueIndex = useSetRecoilState(currentQueueIndexState);
  const setQueueSession = useSetRecoilState(queueSessionState);
  const setLastCallOutcome = useSetRecoilState(lastCallOutcomeState);
  const setSelectedContact = useSetRecoilState(selectedContactState);
  const setPhoneNumber = useSetRecoilState(phoneNumberState);
  const setCallState = useSetRecoilState(callStateAtom);

  const { connect, disconnect } = useTwilioDevice();
  const { recordResult } = useQueueOperations();

  const [wrapUpState, setWrapUpState] = useState<OpportunityWrapUpState | null>(
    null,
  );
  const [backendQueue, setBackendQueue] = useState<BackendQueue | null>(null);

  const { records } = useFindManyRecords<ListMemberWorkspaceRecord>({
    objectNameSingular: 'listMember',
    filter: { listId: { eq: listId } },
    recordGqlFields: {
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
    },
  });

  const orderedRecords = useMemo(() => {
    return [...records].sort(
      (left, right) => (left.position ?? 0) - (right.position ?? 0),
    );
  }, [records]);

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
      await updateOneRecord({
        objectNameSingular: 'opportunity',
        idToUpdate: listId,
        updateOneRecordInput,
      });
    },
    [listId, updateOneRecord],
  );

  const syncCurrentIndexFromContactId = useCallback(
    async (contactId: string | null | undefined) => {
      if (!contactId) {
        return;
      }

      const nextIndex = callableRecords.findIndex(
        (record) => record.id === contactId,
      );

      if (nextIndex < 0 || nextIndex === persistedCurrentIndex) {
        return;
      }

      await updateListRecord({ currentIndex: nextIndex });
    },
    [callableRecords, persistedCurrentIndex, updateListRecord],
  );

  const loadBackendQueue = useCallback(async () => {
    try {
      const response = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/api/v1/queues?sourceType=list&sourceId=${encodeURIComponent(listId)}`,
      );

      if (!response.ok) {
        throw new Error(`Queue lookup failed with status ${response.status}`);
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
        throw new Error(
          `Queue detail lookup failed with status ${detailResponse.status}`,
        );
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
    const existingQueue = await loadBackendQueue();

    if (existingQueue) {
      return existingQueue;
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
          },
          contactIds: callableRecords.map((record) => record.id),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Queue creation failed with status ${response.status}`);
    }

    return await loadBackendQueue();
  }, [callableRecords, listId, listName, loadBackendQueue]);

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

  const currentQueueItem = useMemo(() => {
    const index = persistedCurrentIndex ?? 0;
    return hydratedQueueItems[index] ?? null;
  }, [hydratedQueueItems, persistedCurrentIndex]);

  const hasNextQueueItem = useMemo(() => {
    const index = persistedCurrentIndex ?? 0;
    return hydratedQueueItems[index + 1] !== undefined;
  }, [hydratedQueueItems, persistedCurrentIndex]);

  const autoStartedItemIdRef = useRef<string | null>(null);
  const previousCallStatusRef = useRef(callState.status);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const startBackendQueueSession = useCallback(async () => {
    if (listStatus !== 'ACTIVE') {
      return null;
    }

    const queue = await ensureBackendQueue();

    if (!queue) {
      return null;
    }

    const endpoint = queue.status === 'paused' ? 'resume' : 'start';
    const response = await authenticatedFetch(
      `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${queue.id}/${endpoint}`,
      {
        method: 'POST',
      },
    );

    if (!response.ok) {
      throw new Error(
        `Queue ${endpoint} failed with status ${response.status}`,
      );
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
  }, [
    ensureBackendQueue,
    listStatus,
    loadBackendQueue,
    syncCurrentIndexFromContactId,
  ]);

  const advanceBackendQueueSession = useCallback(
    async (outcome: string) => {
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
        throw new Error(`Queue next failed with status ${response.status}`);
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
    },
    [
      backendQueue?.id,
      loadBackendQueue,
      syncCurrentIndexFromContactId,
      updateListRecord,
    ],
  );

  useEffect(() => {
    const callingQueueItemIndex = hydratedQueueItems.findIndex(
      (item) => item.status === 'calling',
    );

    setActiveQueue({
      id: backendQueue?.id ?? listId,
      name: backendQueue?.name ?? listName ?? 'Calling list',
      description: null,
      sourceType: 'list',
      sourceId: listId,
      totalContacts: backendQueue?.total_contacts ?? hydratedQueueItems.length,
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
        autoAdvance: false,
      },
      createdAt: backendQueue?.created_at ?? new Date().toISOString(),
      updatedAt: backendQueue?.updated_at ?? new Date().toISOString(),
      startedAt: backendQueue?.started_at ?? sessionStartedAt,
      completedAt: backendQueue?.completed_at ?? null,
      category: backendQueue?.category === 'all' ? 'all' : 'custom',
      callingMode: 'browser',
      dncFilteredCount: 0,
      parallelDialingEnabled: false,
      parallelDialFromNumbers: [],
      parallelDialingActive: false,
      parallelCurrentBatch: 0,
      parallelGroupId: null,
      parallelActiveCalls: [],
      aggregatedStats: null,
    });
    setQueueItems(hydratedQueueItems);
    setCurrentQueueIndex(
      callingQueueItemIndex >= 0
        ? callingQueueItemIndex
        : (persistedCurrentIndex ?? 0),
    );
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
    hydratedQueueItems,
    backendQueue,
    listId,
    listName,
    listStatus,
    persistedCurrentIndex,
    sessionStartedAt,
    setActiveQueue,
    setCurrentQueueIndex,
    setQueueItems,
    setQueueSession,
  ]);

  useEffect(() => {
    if (listStatus !== 'ACTIVE' || callableRecords.length === 0) {
      return;
    }

    void startBackendQueueSession().catch((error: unknown) => {
      Sentry.captureException(error, {
        extra: { context: 'startBackendQueueSession', listId },
      });
    });
  }, [callableRecords.length, listId, listStatus, startBackendQueueSession]);

  const startCurrentQueueItem = useCallback(async () => {
    const fromNumber =
      selectedCallerId ?? availableCallerIds[0]?.phoneNumber ?? null;

    if (!currentQueueItem || !fromNumber) {
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
              attempts: queueItem.attempts + 1,
              lastAttemptAt: new Date().toISOString(),
            }
          : queueItem,
      ),
    );
    setSelectedContact(currentQueueItem.contact);
    setPhoneNumber(currentQueueItem.contact.phone);
    setCallState((previousCallState) => ({
      ...previousCallState,
      contact: currentQueueItem.contact,
      fromNumber,
    }));

    try {
      await connect({ To: currentQueueItem.contact.phone, From: fromNumber });
    } catch (error: unknown) {
      autoStartedItemIdRef.current = null;
      Sentry.captureException(error, {
        extra: { context: 'startCurrentQueueItem', listId },
      });
    }
  }, [
    availableCallerIds,
    connect,
    currentQueueItem,
    listId,
    selectedCallerId,
    setCallState,
    setPhoneNumber,
    setSelectedContact,
  ]);

  useEffect(() => {
    if (
      listStatus !== 'ACTIVE' ||
      !['idle', 'ended', 'failed'].includes(callState.status) ||
      !currentQueueItem ||
      currentQueueItem.status !== 'calling' ||
      autoStartedItemIdRef.current === currentQueueItem.id
    ) {
      return;
    }

    void startCurrentQueueItem();
  }, [callState.status, currentQueueItem, listStatus, startCurrentQueueItem]);

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
    if (!backendQueue?.id) {
      await updateListRecord({ listStatus: 'PAUSED' });

      return;
    }

    await authenticatedFetch(
      `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${backendQueue.id}/pause`,
      { method: 'POST' },
    );
    await loadBackendQueue();
    await updateListRecord({ listStatus: 'PAUSED' });
    autoStartedItemIdRef.current = null;
  }, [backendQueue?.id, loadBackendQueue, updateListRecord]);

  const resumeList = useCallback(async () => {
    await updateListRecord({ listStatus: 'ACTIVE' });
    await startBackendQueueSession();
    autoStartedItemIdRef.current = null;
  }, [startBackendQueueSession, updateListRecord]);

  const skipCurrentListMember = useCallback(
    async (reason: string) => {
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
        throw new Error(`Queue skip failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        nextItem?: { contact_id?: string | null } | null;
        suppression?: { contactId?: string | null } | null;
      };

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
      await loadBackendQueue();
      await syncCurrentIndexFromContactId(
        payload.nextItem?.contact_id ?? payload.suppression?.contactId,
      );
      autoStartedItemIdRef.current = null;
    },
    [
      backendQueue?.id,
      callState.callSid,
      callState.duration,
      currentQueueItem,
      disconnect,
      loadBackendQueue,
      syncCurrentIndexFromContactId,
      updateOneRecord,
    ],
  );

  const restartList = useCallback(async () => {
    if (backendQueue?.id) {
      const response = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/api/v1/queues/${backendQueue.id}/restart`,
        { method: 'POST' },
      );

      if (!response.ok) {
        throw new Error(`Queue restart failed with status ${response.status}`);
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
  }, [
    backendQueue?.id,
    callableRecords,
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
