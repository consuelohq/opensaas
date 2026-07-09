import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { useGetButtonIcon } from '@/object-record/record-field/ui/hooks/useGetButtonIcon';
import { useIsFieldInputOnly } from '@/object-record/record-field/ui/hooks/useIsFieldInputOnly';
import { type FieldPhonesValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { isFieldPhones } from '@/object-record/record-field/ui/types/guards/isFieldPhones';

import { RecordTableCellContext } from '@/object-record/record-table/contexts/RecordTableCellContext';
import { RecordTableCellButtons } from '@/object-record/record-table/record-table-cell/components/RecordTableCellButtons';
import { useGetSecondaryRecordTableCellButton } from '@/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton';
import { useOpenRecordTableCellFromCell } from '@/object-record/record-table/record-table-cell/hooks/useOpenRecordTableCellFromCell';
import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';
import { useContext } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconArrowUpRight, IconPencil } from 'twenty-ui/display';

export const RecordTableCellEditButton = () => {
  const { cellPosition } = useContext(RecordTableCellContext);
  const { fieldDefinition, recordId } = useContext(FieldContext);
  const { openTableCell } = useOpenRecordTableCellFromCell();
  const isFieldInputOnly = useIsFieldInputOnly();
  const isFirstColumn = cellPosition.column === 0;
  const customButtonIcon = useGetButtonIcon();

  const fieldPhonesValue = useRecordFieldValue<FieldPhonesValue | undefined>(
    recordId,
    fieldDefinition.metadata.fieldName,
    fieldDefinition,
  );

  const secondaryButton = useGetSecondaryRecordTableCellButton();

  const mainButtonIcon = isFirstColumn
    ? IconArrowUpRight
    : isDefined(customButtonIcon)
      ? customButtonIcon
      : IconPencil;

  const handleMainButtonClick = () => {
    if (isFieldPhones(fieldDefinition) && isDefined(fieldPhonesValue)) {
      const { primaryPhoneCallingCode = '', primaryPhoneNumber = '' } =
        fieldPhonesValue;
      const phoneNumber = `${primaryPhoneCallingCode}${primaryPhoneNumber}`;

      window.open(`tel:${phoneNumber}`, '_blank');
      return;
    }

    if (!isFieldInputOnly && isFirstColumn) {
      openTableCell(undefined, true);
    } else {
      openTableCell();
    }
  };

  return (
    <RecordTableCellButtons
      buttons={[
        ...secondaryButton,
        {
          onClick: handleMainButtonClick,
          Icon: mainButtonIcon,
        },
      ]}
    />
  );
};
