import styled from '@emotion/styled';
import { useCallback, useState } from 'react';

import { OutputFormatSelect } from '@/agent/components/skill-editor/OutputFormatSelect';
import { SandboxTemplateEditor } from '@/agent/components/skill-editor/SandboxTemplateEditor';
import { SkillCategorySelect } from '@/agent/components/skill-editor/SkillCategorySelect';
import { SystemPromptEditor } from '@/agent/components/skill-editor/SystemPromptEditor';
import { type SkillFormData } from '@/agent/types/skill-editor';

type SkillEditorFormProps = {
  skillId?: string;
  onSave: (skill: SkillFormData) => void;
  onCancel: () => void;
};

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledLabel = styled.label`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 13px;
  font-weight: 500;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledTextarea = styled.textarea`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  outline: none;
  resize: vertical;
  min-height: 60px;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledToggle = styled.div`
  display: flex;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledToggleOption = styled.button<{ active: boolean }>`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(2)};
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 120ms;
  background: ${({ active, theme }) =>
    active ? theme.color.blue : theme.background.secondary};
  color: ${({ active, theme }) =>
    active ? '#fff' : theme.font.color.secondary};
`;

const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border: 1px solid
    ${({ variant, theme }) =>
      variant === 'primary' ? 'transparent' : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ variant, theme }) =>
    variant === 'primary' ? theme.color.blue : theme.background.secondary};
  color: ${({ variant, theme }) =>
    variant === 'primary' ? '#fff' : theme.font.color.primary};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 120ms;

  &:hover {
    opacity: 0.9;
  }
`;

const INITIAL_FORM_DATA: SkillFormData = {
  name: '',
  description: '',
  icon: '🔧',
  category: 'custom',
  outputFormat: 'text',
  systemPrompt: '',
  sandboxTemplate: '',
  sandboxLanguage: 'python',
};

export const SkillEditorForm = ({
  onSave,
  onCancel,
}: SkillEditorFormProps) => {
  const [formData, setFormData] = useState<SkillFormData>(INITIAL_FORM_DATA);

  const updateField = useCallback(
    <TKey extends keyof SkillFormData>(
      field: TKey,
      value: SkillFormData[TKey],
    ) => {
      setFormData((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      onSave(formData);
    },
    [formData, onSave],
  );

  return (
    <StyledForm onSubmit={handleSubmit}>
      <StyledRow>
        <StyledField style={{ flex: 1 }}>
          <StyledLabel htmlFor="skill-name">Name</StyledLabel>
          <StyledInput
            id="skill-name"
            value={formData.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Skill name"
          />
        </StyledField>
        <StyledField>
          <StyledLabel htmlFor="skill-icon">Icon</StyledLabel>
          <StyledInput
            id="skill-icon"
            value={formData.icon}
            onChange={(event) => updateField('icon', event.target.value)}
            style={{ width: 60, textAlign: 'center' }}
          />
        </StyledField>
      </StyledRow>

      <StyledField>
        <StyledLabel htmlFor="skill-description">Description</StyledLabel>
        <StyledTextarea
          id="skill-description"
          value={formData.description}
          onChange={(event) => updateField('description', event.target.value)}
          placeholder="What does this skill do?"
        />
      </StyledField>

      <StyledRow>
        <StyledField style={{ flex: 1 }}>
          <StyledLabel>Category</StyledLabel>
          <SkillCategorySelect
            value={formData.category}
            onChange={(value) => updateField('category', value)}
          />
        </StyledField>
        <StyledField style={{ flex: 1 }}>
          <StyledLabel>Output Format</StyledLabel>
          <OutputFormatSelect
            value={formData.outputFormat}
            onChange={(value) => updateField('outputFormat', value)}
          />
        </StyledField>
      </StyledRow>

      <StyledField>
        <StyledLabel>System Prompt</StyledLabel>
        <SystemPromptEditor
          value={formData.systemPrompt}
          onChange={(value) => updateField('systemPrompt', value)}
        />
      </StyledField>

      <StyledField>
        <StyledRow>
          <StyledLabel style={{ flex: 1 }}>Sandbox Template</StyledLabel>
          <StyledToggle>
            <StyledToggleOption
              type="button"
              active={formData.sandboxLanguage === 'python'}
              onClick={() => updateField('sandboxLanguage', 'python')}
            >
              Python
            </StyledToggleOption>
            <StyledToggleOption
              type="button"
              active={formData.sandboxLanguage === 'javascript'}
              onClick={() => updateField('sandboxLanguage', 'javascript')}
            >
              JavaScript
            </StyledToggleOption>
          </StyledToggle>
        </StyledRow>
        <SandboxTemplateEditor
          value={formData.sandboxTemplate}
          onChange={(value) => updateField('sandboxTemplate', value)}
          language={formData.sandboxLanguage}
        />
      </StyledField>

      <StyledActions>
        <StyledButton type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </StyledButton>
        <StyledButton type="submit" variant="primary">
          Save Skill
        </StyledButton>
      </StyledActions>
    </StyledForm>
  );
};
