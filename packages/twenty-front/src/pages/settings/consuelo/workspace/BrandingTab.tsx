import { useState } from 'react';
import styled from '@emotion/styled';
import { Section } from '@/ui/layout/section/components/Section';
import { H2Title } from 'twenty-ui/display';
import { Button, TextInput } from 'twenty-ui/input';
import type { WorkspaceBranding } from '@/settings/types/workspace';

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledLabel = styled.label`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledUploadRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledUploadBox = styled.label`
  width: 80px;
  height: 80px;
  border: 2px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  input {
    display: none;
  }
`;

const StyledColorRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  align-items: center;
`;

const StyledColorInput = styled.input`
  width: 36px;
  height: 36px;
  border: none;
  padding: 0;
  cursor: pointer;
  background: none;
`;

type Props = {
  branding: WorkspaceBranding;
  onSave: (branding: WorkspaceBranding) => Promise<void>;
};

export const BrandingTab = ({ branding, onSave }: Props) => {
  const [draft, setDraft] = useState(branding);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<WorkspaceBranding>) =>
    setDraft((prev) => ({ ...prev, ...p }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(branding);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(draft);
    } catch {
      // api error
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Section>
        <H2Title title="Logo & Favicon" description="Upload brand images" />
        <StyledUploadRow>
          <StyledField>
            <StyledLabel>Logo</StyledLabel>
            <StyledUploadBox
              style={draft.logoUrl ? { backgroundImage: `url(${draft.logoUrl})` } : undefined}
            >
              {!draft.logoUrl && 'Upload'}
              <input type="file" accept="image/*" onChange={() => {}} />
            </StyledUploadBox>
          </StyledField>
          <StyledField>
            <StyledLabel>Favicon</StyledLabel>
            <StyledUploadBox
              style={draft.faviconUrl ? { backgroundImage: `url(${draft.faviconUrl})` } : undefined}
            >
              {!draft.faviconUrl && 'Upload'}
              <input type="file" accept="image/*" onChange={() => {}} />
            </StyledUploadBox>
          </StyledField>
        </StyledUploadRow>
      </Section>
      <Section>
        <H2Title title="Colors" description="Primary and accent colors" />
        <StyledColorRow>
          <StyledField>
            <StyledLabel>Primary</StyledLabel>
            <StyledColorInput
              type="color"
              value={draft.primaryColor}
              onChange={(e) => patch({ primaryColor: e.target.value })}
            />
          </StyledField>
          <StyledField>
            <StyledLabel>Accent</StyledLabel>
            <StyledColorInput
              type="color"
              value={draft.accentColor}
              onChange={(e) => patch({ accentColor: e.target.value })}
            />
          </StyledField>
        </StyledColorRow>
      </Section>
      <Section>
        <H2Title title="Company info" description="Name, email, and custom domain" />
        <StyledGrid>
          <StyledField>
            <StyledLabel>Company name</StyledLabel>
            <TextInput
              value={draft.companyName}
              onChange={(v) => patch({ companyName: v })}
              placeholder="Acme Inc."
              fullWidth
            />
          </StyledField>
          <StyledField>
            <StyledLabel>Support email</StyledLabel>
            <TextInput
              value={draft.supportEmail}
              onChange={(v) => patch({ supportEmail: v })}
              placeholder="support@example.com"
              fullWidth
            />
          </StyledField>
          <StyledField>
            <StyledLabel>Custom domain</StyledLabel>
            <TextInput
              value={draft.customDomain ?? ''}
              onChange={(v) => patch({ customDomain: v || null })}
              placeholder="app.example.com"
              fullWidth
            />
          </StyledField>
        </StyledGrid>
      </Section>
      {dirty && (
        <Button
          title={saving ? 'Saving...' : 'Save branding'}
          onClick={handleSave}
          disabled={saving}
          variant="primary"
        />
      )}
    </>
  );
};
