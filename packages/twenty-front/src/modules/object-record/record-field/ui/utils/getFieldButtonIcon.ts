import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import { type FieldMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import { isFieldDisplayedAsPhone } from '@/object-record/record-field/ui/types/guards/isFieldDisplayedAsPhone';
import { isFieldEmails } from '@/object-record/record-field/ui/types/guards/isFieldEmails';
import { isFieldLinks } from '@/object-record/record-field/ui/types/guards/isFieldLinks';
import { isFieldMultiSelect } from '@/object-record/record-field/ui/types/guards/isFieldMultiSelect';
import { isFieldPhones } from '@/object-record/record-field/ui/types/guards/isFieldPhones';
import { isFieldRelation } from '@/object-record/record-field/ui/types/guards/isFieldRelation';
import { createElement } from 'react';
import { isUndefinedOrNull } from '~/utils/isUndefinedOrNull';

import { isFieldArray } from '@/object-record/record-field/ui/types/guards/isFieldArray';
import { isFieldFiles } from '@/object-record/record-field/ui/types/guards/isFieldFiles';
import { IconPencil, type IconComponent } from 'twenty-ui/display';

const PhoneActionIcon = ({ size = 16 }: { size?: number | string }) =>
  createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    createElement('path', {
      d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
    }),
  );

export const getFieldButtonIcon = (
  fieldDefinition:
    | Pick<FieldDefinition<FieldMetadata>, 'type' | 'metadata'>
    | undefined
    | null,
): IconComponent | undefined => {
  if (isUndefinedOrNull(fieldDefinition)) return undefined;

  if (
    isFieldDisplayedAsPhone(fieldDefinition) ||
    isFieldPhones(fieldDefinition)
  ) {
    return PhoneActionIcon;
  }

  if (
    isFieldMultiSelect(fieldDefinition) ||
    (isFieldRelation(fieldDefinition) &&
      fieldDefinition.metadata.relationObjectMetadataNameSingular !==
        'workspaceMember') ||
    isFieldLinks(fieldDefinition) ||
    isFieldEmails(fieldDefinition) ||
    isFieldArray(fieldDefinition) ||
    isFieldFiles(fieldDefinition)
  ) {
    return IconPencil;
  }
};
