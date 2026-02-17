import { useOpenRecordInCommandMenu } from '@/command-menu/hooks/useOpenRecordInCommandMenu';
import { RecordBoardContext } from '@/object-record/record-board/contexts/RecordBoardContext';
import { useActiveRecordBoardCard } from '@/object-record/record-board/hooks/useActiveRecordBoardCard';
import { useFocusedRecordBoardCard } from '@/object-record/record-board/hooks/useFocusedRecordBoardCard';
import { useRecordBoardSelectAllHotkeys } from '@/object-record/record-board/hooks/useRecordBoardSelectAllHotkeys';
import { useRecordBoardSelection } from '@/object-record/record-board/hooks/useRecordBoardSelection';
import { useResetRecordBoardSelection } from '@/object-record/record-board/hooks/useResetRecordBoardSelection';
import { RecordBoardCardContext } from '@/object-record/record-board/record-board-card/contexts/RecordBoardCardContext';
import { RECORD_BOARD_CARD_INPUT_ID_PREFIX } from '@/object-record/record-board/record-board-card/constants/RecordBoardCardInputIdPrefix';
import { isRecordBoardCardSelectedComponentFamilyState } from '@/object-record/record-board/states/isRecordBoardCardSelectedComponentFamilyState';
import { recordBoardSelectedRecordIdsComponentSelector } from '@/object-record/record-board/states/selectors/recordBoardSelectedRecordIdsComponentSelector';
import { visibleRecordFieldsComponentSelector } from '@/object-record/record-field/states/visibleRecordFieldsComponentSelector';
import { useOpenFieldInputEditMode } from '@/object-record/record-field/ui/hooks/useOpenFieldInputEditMode';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useRecoilComponentFamilyValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentFamilyValue';
import { useRecoilComponentValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue';
import { useCallback, useContext } from 'react';
import { Key } from 'ts-key-enum';

const FIELD_SHORTCUT_MAP: Record<string, string[]> = {
  a: ['assignee', 'accountOwner'],
  s: ['status', 'stage'],
  l: ['label', 'labels', 'tags'],
  p: ['priority'],
};

export const useRecordBoardCardHotkeys = (focusId: string) => {
  const { objectMetadataItem, recordBoardId } = useContext(RecordBoardContext);
  const { recordId, rowIndex, columnIndex } = useContext(
    RecordBoardCardContext,
  );

  const { openRecordInCommandMenu } = useOpenRecordInCommandMenu();
  const { activateBoardCard } = useActiveRecordBoardCard();
  const { setRecordAsSelected } = useRecordBoardSelection();

  const { resetRecordBoardSelection } = useResetRecordBoardSelection();
  const { unfocusBoardCard } = useFocusedRecordBoardCard(recordBoardId);

  const { openFieldInput } = useOpenFieldInputEditMode();

  const {
    labelIdentifierFieldMetadataItem,
    fieldDefinitionByFieldMetadataItemId,
  } = useRecordIndexContextOrThrow();

  const visibleRecordFields = useRecoilComponentValue(
    visibleRecordFieldsComponentSelector,
  );

  const visibleRecordFieldsExceptLabelIdentifier = visibleRecordFields.filter(
    (recordField) =>
      recordField.fieldMetadataItemId !== labelIdentifierFieldMetadataItem?.id,
  );

  const isRecordBoardCardSelected = useRecoilComponentFamilyValue(
    isRecordBoardCardSelectedComponentFamilyState,
    recordId,
  );

  const selectedRecordIds = useRecoilComponentValue(
    recordBoardSelectedRecordIdsComponentSelector,
    recordBoardId,
  );

  const isAtLeastOneRecordSelected = selectedRecordIds.length > 0;

  const handleSelectCard = () => {
    setRecordAsSelected(recordId, !isRecordBoardCardSelected);
  };

  const handleOpenRecordInCommandMenu = () => {
    openRecordInCommandMenu({
      recordId,
      objectNameSingular: objectMetadataItem.nameSingular,
      isNewRecord: false,
    });

    activateBoardCard({
      rowIndex,
      columnIndex,
    });
  };

  const handleEscape = () => {
    unfocusBoardCard();

    if (isAtLeastOneRecordSelected) {
      resetRecordBoardSelection();
    }
  };

  const openEditModeForFieldNames = useCallback(
    (candidateNames: string[]) => {
      for (
        let index = 0;
        index < visibleRecordFieldsExceptLabelIdentifier.length;
        index++
      ) {
        const recordField = visibleRecordFieldsExceptLabelIdentifier[index];
        const fieldDefinition =
          fieldDefinitionByFieldMetadataItemId[recordField.fieldMetadataItemId];

        if (!fieldDefinition) continue;

        const fieldName = fieldDefinition.metadata.fieldName;
        if (candidateNames.includes(fieldName)) {
          openFieldInput({
            fieldDefinition,
            recordId,
            prefix: RECORD_BOARD_CARD_INPUT_ID_PREFIX,
          });
          return;
        }
      }
    },
    [
      visibleRecordFieldsExceptLabelIdentifier,
      fieldDefinitionByFieldMetadataItemId,
      openFieldInput,
      recordId,
    ],
  );

  useHotkeysOnFocusedElement({
    keys: ['x'],
    callback: handleSelectCard,
    focusId,
    dependencies: [handleSelectCard],
  });

  useHotkeysOnFocusedElement({
    keys: [
      Key.Enter,
      `${Key.Control}+${Key.Enter}`,
      `${Key.Meta}+${Key.Enter}`,
    ],
    callback: handleOpenRecordInCommandMenu,
    focusId,
    dependencies: [handleOpenRecordInCommandMenu],
  });

  useHotkeysOnFocusedElement({
    keys: [Key.Escape],
    callback: handleEscape,
    focusId,
    dependencies: [handleEscape],
  });

  useHotkeysOnFocusedElement({
    keys: ['a'],
    callback: () => openEditModeForFieldNames(FIELD_SHORTCUT_MAP.a),
    focusId,
    dependencies: [openEditModeForFieldNames],
  });

  useHotkeysOnFocusedElement({
    keys: ['s'],
    callback: () => openEditModeForFieldNames(FIELD_SHORTCUT_MAP.s),
    focusId,
    dependencies: [openEditModeForFieldNames],
  });

  useHotkeysOnFocusedElement({
    keys: ['l'],
    callback: () => openEditModeForFieldNames(FIELD_SHORTCUT_MAP.l),
    focusId,
    dependencies: [openEditModeForFieldNames],
  });

  useHotkeysOnFocusedElement({
    keys: ['p'],
    callback: () => openEditModeForFieldNames(FIELD_SHORTCUT_MAP.p),
    focusId,
    dependencies: [openEditModeForFieldNames],
  });

  useRecordBoardSelectAllHotkeys({
    recordBoardId,
    focusId,
  });
};
