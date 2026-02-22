import styled from '@emotion/styled';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback, useRef } from 'react';

import { CRM_VARIABLES } from '@/agent/constants/skill-editor';

type SystemPromptEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

const StyledContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
`;

export const SystemPromptEditor = ({
  value,
  onChange,
}: SystemPromptEditorProps) => {
  const disposableRef = useRef<{ dispose: () => void } | null>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    // register CRM variable completions triggered by '{'
    disposableRef.current = monaco.languages.registerCompletionItemProvider(
      'markdown',
      {
        triggerCharacters: ['{'],
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          return {
            suggestions: CRM_VARIABLES.map((variable) => ({
              label: variable.label,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: variable.insertText,
              detail: variable.description,
              range,
            })),
          };
        },
      },
    );

    return () => {
      disposableRef.current?.dispose();
    };
  }, []);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue ?? '');
    },
    [onChange],
  );

  return (
    <StyledContainer>
      <Editor
        height="300px"
        language="markdown"
        theme="vs-dark"
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          lineNumbers: 'off',
          fontSize: 14,
          scrollBeyondLastLine: false,
          padding: { top: 8 },
        }}
      />
    </StyledContainer>
  );
};
