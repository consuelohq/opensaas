import { useCoachingScripts } from '@/dialer/hooks/useCoachingScripts';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { H2Title, IconTrash } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';

const StyledLayout = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const StyledScriptList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledScriptCard = styled.button<{ isActive: boolean }>`
  align-items: flex-start;
  background: ${({ isActive, theme }) =>
    isActive ? theme.background.secondary : theme.background.primary};
  border: 1px solid
    ${({ isActive, theme }) =>
      isActive ? theme.color.blue : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: left;
  width: 100%;
`;

const StyledScriptName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledScriptMeta = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
`;

const StyledEditorCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledHeaderRow = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledEmpty = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: center;
  min-height: 240px;
  text-align: center;
`;

export const SettingsAIScripts = () => {
  const {
    scripts,
    selectedScript,
    selectedScriptSections,
    selectedScriptId,
    setSelectedScriptId,
    createScript,
    updateScript,
    deleteScript,
  } = useCoachingScripts();

  return (
    <Section>
      <H2Title
        title={t`Scripts`}
        description={t`Manage the scripts your team can use during calls.`}
      />

      <StyledLayout>
        <StyledScriptList>
          <Button
            title={t`Add script`}
            variant="secondary"
            onClick={createScript}
          />

          {scripts.map((script) => {
            const characterCount = script.content.length;

            return (
              <StyledScriptCard
                key={script.id}
                isActive={script.id === selectedScriptId}
                onClick={() => setSelectedScriptId(script.id)}
                type="button"
              >
                <StyledScriptName>{script.name}</StyledScriptName>
                <StyledScriptMeta>
                  {t`${characterCount} characters`}
                </StyledScriptMeta>
              </StyledScriptCard>
            );
          })}
        </StyledScriptList>

        <StyledEditorCard rounded>
          {selectedScript ? (
            <>
              <StyledHeaderRow>
                <H2Title
                  title={selectedScript.name}
                  description={t`Use markdown headings to break the script into sections for live guidance.`}
                />
                <StyledActions>
                  <Button
                    title={t`Delete`}
                    variant="secondary"
                    accent="danger"
                    Icon={IconTrash}
                    onClick={() => deleteScript(selectedScript.id)}
                  />
                </StyledActions>
              </StyledHeaderRow>

              <TextInput
                label={t`Script name`}
                value={selectedScript.name}
                onChange={(value) =>
                  updateScript(selectedScript.id, { name: value })
                }
                fullWidth
              />

              <TextArea
                textAreaId={`settings-ai-script-${selectedScript.id}`}
                label={t`Script content`}
                minRows={16}
                value={selectedScript.content}
                onChange={(value) =>
                  updateScript(selectedScript.id, {
                    content: value,
                  })
                }
                placeholder={t`# Opening\n\nIntroduce yourself and explain why you are calling.\n\n# Discovery\n\nAsk about the current workflow, goals, and blockers.`}
              />

              <StyledScriptMeta>
                {t`${selectedScriptSections.length} live sections detected`}
              </StyledScriptMeta>
            </>
          ) : (
            <StyledEmpty>
              <span>{t`Create a script to start guiding calls.`}</span>
              <Button
                title={t`Create your first script`}
                onClick={createScript}
              />
            </StyledEmpty>
          )}
        </StyledEditorCard>
      </StyledLayout>
    </Section>
  );
};
