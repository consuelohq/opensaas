import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { captureException } from '@sentry/react';

import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { currentQueueIndexState, queueSessionState } from '@/dialer/states/queueState';

type RecordResultData = {
  disposition: string;
  callSid: string;
  duration: number;
};

export const useQueueOperations = () => {
  const { updateOneRecord } = useUpdateOneRecord();
  const currentIndex = useRecoilValue(currentQueueIndexState);
  const session = useRecoilValue(queueSessionState);

  const startQueue = useCallback(
    async (listId: string) => {
      try {
        await updateOneRecord({
          objectNameSingular: 'opportunity',
          idToUpdate: listId,
          updateOneRecordInput: {
            listStatus: 'ACTIVE',
            sessionStartedAt: new Date().toISOString(),
            currentIndex: 0,
          },
        });
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'startQueue', listId } });
        throw err;
      }
    },
    [updateOneRecord],
  );

  const pauseQueue = useCallback(
    async (listId: string) => {
      try {
        await updateOneRecord({
          objectNameSingular: 'opportunity',
          idToUpdate: listId,
          updateOneRecordInput: { listStatus: 'PAUSED' },
        });
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'pauseQueue', listId } });
        throw err;
      }
    },
    [updateOneRecord],
  );

  const resumeQueue = useCallback(
    async (listId: string) => {
      try {
        await updateOneRecord({
          objectNameSingular: 'opportunity',
          idToUpdate: listId,
          updateOneRecordInput: { listStatus: 'ACTIVE' },
        });
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'resumeQueue', listId } });
        throw err;
      }
    },
    [updateOneRecord],
  );

  const completeQueue = useCallback(
    async (listId: string) => {
      try {
        const now = new Date();
        const startedAt = session?.startedAt
          ? new Date(session.startedAt)
          : now;
        const elapsedSeconds = Math.round(
          (now.getTime() - startedAt.getTime()) / 1000,
        );

        await updateOneRecord({
          objectNameSingular: 'opportunity',
          idToUpdate: listId,
          updateOneRecordInput: {
            listStatus: 'COMPLETED',
            sessionEndedAt: now.toISOString(),
            elapsedSeconds,
          },
        });
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'completeQueue', listId } });
        throw err;
      }
    },
    [updateOneRecord, session?.startedAt],
  );

  const advanceQueue = useCallback(
    async (listId: string) => {
      try {
        await updateOneRecord({
          objectNameSingular: 'opportunity',
          idToUpdate: listId,
          updateOneRecordInput: { currentIndex: currentIndex + 1 },
        });
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'advanceQueue', listId } });
        throw err;
      }
    },
    [updateOneRecord, currentIndex],
  );

  const recordResult = useCallback(
    async (listMemberId: string, data: RecordResultData) => {
      try {
        await updateOneRecord({
          objectNameSingular: 'listMember',
          idToUpdate: listMemberId,
          updateOneRecordInput: {
            status: 'COMPLETED',
            disposition: data.disposition,
            callSid: data.callSid,
            duration: data.duration,
            attemptedAt: new Date().toISOString(),
          },
        });
      } catch (err: unknown) {
        captureException(err, {
          extra: { context: 'recordResult', listMemberId },
        });
        throw err;
      }
    },
    [updateOneRecord],
  );

  return {
    startQueue,
    pauseQueue,
    resumeQueue,
    completeQueue,
    advanceQueue,
    recordResult,
  };
};
