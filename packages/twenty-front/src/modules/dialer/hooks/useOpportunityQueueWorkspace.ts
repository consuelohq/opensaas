import * as Sentry from '@sentry/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
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
import { type DialerContact } from '@/dialer/types/dialer';
import {
  DEFAULT_QUEUE_SETTINGS,
  type QueueItem,
  type QueueOutcome,
} from '@/dialer/types/queue';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
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
  } | null;
  personId?: string | null;
  phoneNumber?: unknown;
};

type WrapUpOutcome = 'answered' | 'no-answer';

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

  const setActiveQueue = useSetRecoilState(activeQueueState);
  const setQueueItems = useSetRecoilState(queueItemsState);
  const setCurrentQueueIndex = useSetRecoilState(currentQueueIndexState);
  const setQueueSession = useSetRecoilState(queueSessionState);
  const setLastCallOutcome = useSetRecoilState(lastCallOutcomeState);
  const setSelectedContact = useSetRecoilState(selectedContactState);
  const setPhoneNumber = useSetRecoilState(phoneNumberState);
  const setCallState = useSetRecoilState(callStateAtom);

  const { connect } = useTwilioDevice();
  const { advanceQueue, completeQueue, recordResult } = useQueueOperations();

  const [wrapUpState, setWrapUpState] = useState<OpportunityWrapUpState | null>(
    null,
  );

  const { records } = useFindManyRecords<ListMemberWorkspaceRecord>({
    objectNameSingular: 'listMember',
    filter: { listId: { eq: listId } },
  });

  const orderedRecords = useMemo(() => {
    return [...records].sort(
      (left, right) => (left.position ?? 0) - (right.position ?? 0),
    );
  }, [records]);

  const hydratedQueueItems = useMemo<QueueItem[]>(() => {
    return orderedRecords.reduce<QueueItem[]>((queueItems, record, index) => {
      const phoneNumber = extractPhoneNumber(record.phoneNumber);

      if (!phoneNumber) {
        return queueItems;
      }

      queueItems.push({
        id: record.id,
        queueId: listId,
        contactId: record.personId ?? record.id,
        contact: mapRecordToDialerContact(record, phoneNumber),
        position: record.position ?? index,
        status:
          record.status === 'COMPLETED'
            ? 'completed'
            : record.status === 'SKIPPED'
              ? 'skipped'
              : 'pending',
        attempts: record.status === 'PENDING' ? 0 : 1,
        lastAttemptAt: null,
        callOutcome: mapDispositionToOutcome(record.disposition),
        notes: null,
        skipReason: null,
        callDurationSeconds: null,
      } satisfies QueueItem);

      return queueItems;
    }, []);
  }, [listId, orderedRecords]);

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

  const markQueueItemCompleted = useCallback(
    (queueItemId: string, outcome: QueueOutcome) => {
      setQueueItems((previousQueueItems) =>
        previousQueueItems.map((queueItem) =>
          queueItem.id === queueItemId
            ? {
                ...queueItem,
                status: 'completed',
                callOutcome: outcome,
                callDurationSeconds: callState.duration,
              }
            : queueItem,
        ),
      );
    },
    [callState.duration, setQueueItems],
  );

  useEffect(() => {
    setActiveQueue({
      id: listId,
      name: listName ?? 'Calling list',
      description: null,
      sourceType: 'list',
      sourceId: listId,
      totalContacts: hydratedQueueItems.length,
      completedContacts: hydratedQueueItems.filter(
        (item) => item.status === 'completed',
      ).length,
      skippedContacts: hydratedQueueItems.filter(
        (item) => item.status === 'skipped',
      ).length,
      status:
        listStatus === 'ACTIVE'
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: sessionStartedAt,
      completedAt: null,
      category: 'custom',
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
    setCurrentQueueIndex(persistedCurrentIndex ?? 0);
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

  const startCurrentQueueItem = useCallback(async () => {
    const fromNumber =
      selectedCallerId ?? availableCallerIds[0]?.phoneNumber ?? null;

    if (!currentQueueItem || !fromNumber) {
      return;
    }

    autoStartedItemIdRef.current = currentQueueItem.id;
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
      autoStartedItemIdRef.current === currentQueueItem.id
    ) {
      return;
    }

    void startCurrentQueueItem();
  }, [callState.status, currentQueueItem, listStatus, startCurrentQueueItem]);

  useEffect(() => {
    const previousCallStatus = previousCallStatusRef.current;
    previousCallStatusRef.current = callState.status;

    if (callState.status !== 'ended' || !currentQueueItem) {
      return;
    }

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
      }).then(() => {
        markQueueItemCompleted(currentQueueItem.id, 'no-answer');
      });

      autoAdvanceTimerRef.current = setTimeout(() => {
        if (hasNextQueueItem) {
          void advanceQueue(listId);
        } else {
          void completeQueue(listId);
        }
        setWrapUpState(null);
        autoStartedItemIdRef.current = null;
      }, 1200);
      return;
    }

    setLastCallOutcome('connected');
  }, [
    advanceQueue,
    callState.callSid,
    callState.duration,
    callState.status,
    clearAutoAdvanceTimer,
    completeQueue,
    currentQueueItem,
    hasNextQueueItem,
    listId,
    markQueueItemCompleted,
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
        markQueueItemCompleted(wrapUpState.listMemberId, queueOutcome);
        setLastCallOutcome(queueOutcome);
        setWrapUpState(null);
        autoStartedItemIdRef.current = null;

        if (hasNextQueueItem) {
          await advanceQueue(listId);
        } else {
          await completeQueue(listId);
        }
      } catch (error: unknown) {
        Sentry.captureException(error, {
          extra: { context: 'continueList', disposition, listId },
        });
      }
    },
    [
      advanceQueue,
      completeQueue,
      hasNextQueueItem,
      listId,
      markQueueItemCompleted,
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
        markQueueItemCompleted(wrapUpState.listMemberId, queueOutcome);
        setLastCallOutcome(queueOutcome);
        setWrapUpState(null);
        autoStartedItemIdRef.current = null;
        await completeQueue(listId);
      } catch (error: unknown) {
        Sentry.captureException(error, {
          extra: { context: 'endList', disposition, listId },
        });
      }
    },
    [
      completeQueue,
      listId,
      markQueueItemCompleted,
      recordResult,
      saveDisposition,
      setLastCallOutcome,
      wrapUpState,
    ],
  );

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  return {
    wrapUpState,
    currentQueueItem,
    continueList,
    endList,
  };
};
