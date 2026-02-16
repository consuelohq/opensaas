import { useState } from 'react';
import styled from '@emotion/styled';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { TextInput } from '~/modules/ui/input/components/TextInput';
import type { WorkspaceConfig } from '~/modules/settings/types/workspace';

const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: flex-end;
`;

const StyledField = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledLabel = styled.label`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledDanger = styled.div`
  border: 1px solid ${({ theme }) => theme.color.red};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(4)};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledDangerText = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

type Props = {
  workspace: WorkspaceConfig;
  onSave: (patch: { name?: string; slug?: string }) => Promise<void>;
};

export const GeneralTab = ({ workspace, onSave }: Props) => {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [saving, setSaving] = useState(false);

  const dirty = name !== workspace.name || slug !== workspace.slug;

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave({ name, slug });
    } catch {
      // api error — state unchanged
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Section>
        <H2Title title="Workspace" description="Name and URL slug" />
        <StyledRow>
          <StyledField>
            <StyledLabel>Name</StyledLabel>
            <TextInput
              value={name}
              onChange={setName}
              placeholder="My workspace"
              fullWidth
            />
          </StyledField>
          <StyledField>
            <StyledLabel>Slug</StyledLabel>
            <TextInput
              value={slug}
              onChange={setSlug}
              placeholder="my-workspace"
              fullWidth
            />
          </StyledField>
        </StyledRow>
        {dirty && (
          <Button
            title={saving ? 'Saving...' : 'Save changes'}
            onClick={handleSave}
            disabled={saving}
            variant="primary"
          />
        )}
      </Section>
      <Section>
        <H2Title title="Danger zone" description="Irreversible actions" />
        <StyledDanger>
          <StyledDangerText>
            Delete this workspace and all its data permanently.
          </StyledDangerText>
          <Button
            title="Delete workspace"
            variant="secondary"
            accent="danger"
          />
        </StyledDanger>
      </Section>
    </>
  );
};
