import { useMemo } from 'react';

import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

type ListMemberRecord = ObjectRecord & {
  status: string;
  disposition: string | null;
  duration: number | null;
};

type QueueStatsResult = {
  totalMembers: number;
  attempted: number;
  completed: number;
  skipped: number;
  pending: number;
  answerRate: number;
  avgDuration: number;
  dispositionBreakdown: Record<string, number>;
  loading: boolean;
};

export const useQueueStats = (listId: string | undefined): QueueStatsResult => {
  const { records, loading } = useFindManyRecords<ListMemberRecord>({
    objectNameSingular: 'listMember',
    filter: listId ? { listId: { eq: listId } } : undefined,
    skip: !listId,
  });

  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        totalMembers: 0,
        attempted: 0,
        completed: 0,
        skipped: 0,
        pending: 0,
        answerRate: 0,
        avgDuration: 0,
        dispositionBreakdown: {},
      };
    }

    const totalMembers = records.length;
    const pending = records.filter((r) => r.status === 'PENDING').length;
    const attempted = records.filter((r) => r.status !== 'PENDING').length;
    const completed = records.filter((r) => r.status === 'COMPLETED').length;
    const skipped = records.filter((r) => r.status === 'SKIPPED').length;

    const answered = records.filter(
      (r) => r.disposition === 'ANSWERED',
    );
    const answerRate = attempted > 0
      ? Math.round((answered.length / attempted) * 100)
      : 0;

    const answeredDurations = answered
      .map((r) => r.duration)
      .filter((d): d is number => d !== null && d > 0);
    const avgDuration = answeredDurations.length > 0
      ? Math.round(
          answeredDurations.reduce((sum, d) => sum + d, 0) /
            answeredDurations.length,
        )
      : 0;

    const dispositionBreakdown: Record<string, number> = {};
    for (const record of records) {
      if (record.disposition) {
        dispositionBreakdown[record.disposition] =
          (dispositionBreakdown[record.disposition] ?? 0) + 1;
      }
    }

    return {
      totalMembers,
      attempted,
      completed,
      skipped,
      pending,
      answerRate,
      avgDuration,
      dispositionBreakdown,
    };
  }, [records]);

  return { ...stats, loading };
};
