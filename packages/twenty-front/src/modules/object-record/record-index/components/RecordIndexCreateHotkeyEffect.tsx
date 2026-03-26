import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useCreateNewIndexRecord } from '@/object-record/record-table/hooks/useCreateNewIndexRecord';
import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';

export const RecordIndexCreateHotkeyEffect = () => {
  const { objectMetadataItem } = useRecordIndexContextOrThrow();

  const { createNewIndexRecord } = useCreateNewIndexRecord({
    objectMetadataItem,
  });

  useGlobalHotkeys({
    keys: 'c',
    callback: () => {
      createNewIndexRecord({ position: 'first' });
    },
    containsModifier: false,
  });

  return null;
};
