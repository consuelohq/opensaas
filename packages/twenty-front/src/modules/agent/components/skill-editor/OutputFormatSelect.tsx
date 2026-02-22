import styled from '@emotion/styled';
import { useCallback } from 'react';

import { OUTPUT_FORMATS } from '@/agent/constants/skill-editor';
import { type OutputFormat } from '@/agent/types/skill-editor';

type OutputFormatSelectProps = {
  value: OutputFormat;
  onChange: (value: OutputFormat) => void;
};

const StyledSelect = styled.select`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

export const OutputFormatSelect = ({
  value,
  onChange,
}: OutputFormatSelectProps) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(event.target.value as OutputFormat);
    },
    [onChange],
  );

  return (
    <StyledSelect
      value={value}
      onChange={handleChange}
      aria-label="Output format"
    >
      {OUTPUT_FORMATS.map((format) => (
        <option key={format.value} value={format.value}>
          {format.label}
        </option>
      ))}
    </StyledSelect>
  );
};
