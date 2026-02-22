import styled from '@emotion/styled';
import Editor from '@monaco-editor/react';
import { useCallback } from 'react';

type SandboxTemplateEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language: 'python' | 'javascript';
};

const StyledContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
`;

export const SandboxTemplateEditor = ({
  value,
  onChange,
  language,
}: SandboxTemplateEditorProps) => {
  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue ?? '');
    },
    [onChange],
  );

  return (
    <StyledContainer>
      <Editor
        height="400px"
        language={language}
        theme="vs-dark"
        value={value}
        onChange={handleChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          tabSize: language === 'python' ? 4 : 2,
          scrollBeyondLastLine: false,
          padding: { top: 8 },
        }}
      />
    </StyledContainer>
  );
};
