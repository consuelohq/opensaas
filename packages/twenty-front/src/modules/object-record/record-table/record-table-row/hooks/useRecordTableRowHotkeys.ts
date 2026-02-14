import { useOpenRecordInCommandMenu } from '@/command-menu/hooks/useOpenRecordInCommandMenu';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useRecordTableRowContextOrThrow } from '@/object-record/record-table/contexts/RecordTableRowContext';
import { useResetTableRowSelection } from '@/object-record/record-table/hooks/internal/useResetTableRowSelection';
import { useSelectAllRows } from '@/object-record/record-table/hooks/internal/useSelectAllRows';
import { useActiveRecordTableRow } from '@/object-record/record-table/hooks/useActiveRecordTableRow';
import { useFocusedRecordTableRow } from '@/object-record/record-table/hooks/useFocusedRecordTableRow';
import { useFocusRecordTableCell } from '@/object-record/record-table/record-table-cell/hooks/useFocusRecordTableCell';
import { getRecordTableCellFocusId } from '@/object-record/record-table/record-table-cell/utils/getRecordTableCellFocusId';
import { useSetCurrentRowSelected } from '@/object-record/record-table/record-table-row/hooks/useSetCurrentRowSelected';
import { isAtLeastOneTableRowSelectedSelector } from '@/object-record/record-table/record-table-row/states/isAtLeastOneTableRowSelectedSelector';
import { isRecordTableRowFocusActiveComponentState } from '@/object-record/record-table/states/isRecordTableRowFocusActiveComponentState';
import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useRecoilComponentValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue';
import { useSetRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentState';
import { useCallback } from 'react';
import { Key } from 'ts-key-enum';

// DEV-800: single-key → candidate field names (first match wins)
const FIELD_SHORTCUT_MAP: Record<string, string[]> = {
  a: ['assignee', 'accountOwner'],
  s: ['status', 'stage'],
  l: ['label', 'labels', 'tags'],
  p: ['priority'],
};

export const useRecordTableRowHotkeys = (focusId: string) => {
  const { isSelected, recordId, objectNameSingular, rowIndex } =
    useRecordTableRowContextOrThrow();

  const { setCurrentRowSelected } = useSetCurrentRowSelected();

  const { openRecordInCommandMenu } = useOpenRecordInCommandMenu();

  const { activateRecordTableRow } = useActiveRecordTableRow();

  const setIsRowFocusActive = useSetRecoilComponentState(
    isRecordTableRowFocusActiveComponentState,
  );

  const { focusRecordTableCell } = useFocusRecordTableCell();

  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();

  const { recordTableId, objectMetadataItem, visibleRecordFields } =
    useRecordTableContextOrThrow();

  const handleSelectRow = () => {
    setCurrentRowSelected({
      newSelectedState: !isSelected,
    });
  };

  const handleSelectRowWithShift = () => {
    setCurrentRowSelected({
      newSelectedState: !isSelected,
      shouldSelectRange: true,
    });
  };

  const handleOpenRecordInCommandMenu = () => {
    openRecordInCommandMenu({
      recordId: recordId,
      objectNameSingular: objectNameSingular,
      isNewRecord: false,
    });

    activateRecordTableRow(rowIndex);
  };

  const handleEnterRow = () => {
    setIsRowFocusActive(false);
    const cellPosition = {
      row: rowIndex,
      column: 0,
    };
    focusRecordTableCell(cellPosition);

    const cellFocusId = getRecordTableCellFocusId({
      recordTableId,
      cellPosition,
    });

    pushFocusItemToFocusStack({
      focusId: cellFocusId,
      component: {
        type: FocusComponentType.RECORD_TABLE_CELL,
        instanceId: cellFocusId,
      },
    });
  };

  const { resetTableRowSelection } = useResetTableRowSelection(recordTableId);

  const { unfocusRecordTableRow } = useFocusedRecordTableRow(recordTableId);

  const isAtLeastOneRecordSelected = useRecoilComponentValue(
    isAtLeastOneTableRowSelectedSelector,
  );

  const handleEscape = () => {
    unfocusRecordTableRow();
    if (isAtLeastOneRecordSelected) {
      resetTableRowSelection();
    }
  };

  useHotkeysOnFocusedElement({
    keys: ['x'],
    callback: handleSelectRow,
    focusId,
    dependencies: [handleSelectRow],
  });

  useHotkeysOnFocusedElement({
    keys: [`${Key.Shift}+x`],
    callback: handleSelectRowWithShift,
    focusId,
    dependencies: [handleSelectRowWithShift],
  });

  useHotkeysOnFocusedElement({
    keys: [`${Key.Control}+${Key.Enter}`, `${Key.Meta}+${Key.Enter}`],
    callback: handleOpenRecordInCommandMenu,
    focusId,
    dependencies: [handleOpenRecordInCommandMenu],
  });

  useHotkeysOnFocusedElement({
    keys: [Key.Enter],
    callback: handleEnterRow,
    focusId,
    dependencies: [handleEnterRow],
  });

  useHotkeysOnFocusedElement({
    keys: [Key.Escape],
    callback: handleEscape,
    focusId,
    dependencies: [handleEscape],
  });

  const { selectAllRows } = useSelectAllRows();

  const handleSelectAllRows = () => {
    selectAllRows();
  };

  useHotkeysOnFocusedElement({
    keys: ['ctrl+a,meta+a'],
    callback: handleSelectAllRows,
    focusId,
    dependencies: [handleSelectAllRows],
    options: {
      enableOnFormTags: false,
    },
  });

  // DEV-800: focus a cell by field name candidates (first match in visible columns wins)
  const focusCellByFieldNames = useCallback(
    (candidateNames: string[]) => {
      const fields = objectMetadataItem.fields;

      for (const name of candidateNames) {
        const fieldMeta = fields.find((f) => f.name === name);
        if (!fieldMeta) continue;

        const columnIndex = visibleRecordFields.findIndex(
          (rf) => rf.fieldMetadataItemId === fieldMeta.id,
        );
        if (columnIndex === -1) continue;

        setIsRowFocusActive(false);
        const cellPosition = { row: rowIndex, column: columnIndex };
        focusRecordTableCell(cellPosition);

        const cellFocusId = getRecordTableCellFocusId({
          recordTableId,
          cellPosition,
        });

        pushFocusItemToFocusStack({
          focusId: cellFocusId,
          component: {
            type: FocusComponentType.RECORD_TABLE_CELL,
            instanceId: cellFocusId,
          },
        });
        return;
      }
    },
    [
      objectMetadataItem.fields,
      visibleRecordFields,
      rowIndex,
      setIsRowFocusActive,
      focusRecordTableCell,
      recordTableId,
      pushFocusItemToFocusStack,
    ],
  );

  useHotkeysOnFocusedElement({
    keys: ['a'],
    callback: () => focusCellByFieldNames(FIELD_SHORTCUT_MAP.a),
    focusId,
    dependencies: [focusCellByFieldNames],
  });

  useHotkeysOnFocusedElement({
    keys: ['s'],
    callback: () => focusCellByFieldNames(FIELD_SHORTCUT_MAP.s),
    focusId,
    dependencies: [focusCellByFieldNames],
  });

  useHotkeysOnFocusedElement({
    keys: ['l'],
    callback: () => focusCellByFieldNames(FIELD_SHORTCUT_MAP.l),
    focusId,
    dependencies: [focusCellByFieldNames],
  });

  useHotkeysOnFocusedElement({
    keys: ['p'],
    callback: () => focusCellByFieldNames(FIELD_SHORTCUT_MAP.p),
    focusId,
    dependencies: [focusCellByFieldNames],
  });
};
