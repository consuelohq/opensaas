import { useFieldFocus } from '@/object-record/record-field/ui/hooks/useFieldFocus';
import { usePhonesFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/usePhonesFieldDisplay';
import { PhonesDisplay } from '@/ui/field/display/components/PhonesDisplay';
import { useLingui } from '@lingui/react/macro';
import React, { useContext } from 'react';
import { FieldMetadataSettingsOnClickAction } from 'twenty-shared/types';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { ClickToCallButton } from '@/dialer/components/ClickToCallButton';
import styled from '@emotion/styled';

const StyledPhoneFieldWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  width: 100%;
`;

const StyledPhoneDisplayWrapper = styled.div`
  min-width: 0;
  flex: 1;
`;

export const PhonesFieldDisplay = () => {
  const { fieldValue, fieldDefinition } = usePhonesFieldDisplay();
  const { copyToClipboard } = useCopyToClipboard();
  const { isFocused } = useFieldFocus();
  const { recordId } = useContext(FieldContext);

  const { t } = useLingui();

  const onClickAction = fieldDefinition.metadata.settings?.clickAction;

  const handleClick = async (
    phoneNumber: string,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    if (onClickAction === FieldMetadataSettingsOnClickAction.COPY) {
      event.preventDefault();
      copyToClipboard(phoneNumber, t`Phone number copied to clipboard`);
    }
  };

  const primaryPhone = fieldValue?.primaryPhoneNumber
    ? `${fieldValue.primaryPhoneCallingCode ?? ''}${fieldValue.primaryPhoneNumber}`
    : null;

  return (
    <StyledPhoneFieldWrapper>
      <StyledPhoneDisplayWrapper>
        <PhonesDisplay
          value={fieldValue}
          isFocused={isFocused}
          onPhoneNumberClick={handleClick}
        />
      </StyledPhoneDisplayWrapper>
      {primaryPhone && (
        <ClickToCallButton phone={primaryPhone} contactId={recordId} />
      )}
    </StyledPhoneFieldWrapper>
  );
};
