import { transcriptState } from '@/dialer/states/coachingState';
import { useCoachingScripts } from '@/dialer/hooks/useCoachingScripts';
import { getSuggestedScriptSectionIndex } from '@/dialer/utils/parseCoachingScript';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  IconChevronLeft,
  IconChevronRight,
  IconScript,
} from '@tabler/icons-react';

const StyledPanel = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledEyebrow = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledControls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledControlButton = styled.button`
  align-items: center;
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const StyledCurrentSection = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledCurrentTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledBody = styled.pre`
  color: ${({ theme }) => theme.font.color.primary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
`;

const StyledNextSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledNextTitle = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledPreview = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
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

export const ScriptAssistPanel = () => {
  const assistMode = useRecoilValue(callAssistModeState);
  const transcript = useRecoilValue(transcriptState);
  const { selectedScript, selectedScriptSections } = useCoachingScripts();
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  const suggestedSectionIndex = useMemo(
    () =>
      getSuggestedScriptSectionIndex({
        sections: selectedScriptSections,
        transcript,
        currentIndex: activeSectionIndex,
      }),
    [activeSectionIndex, selectedScriptSections, transcript],
  );

  useEffect(() => {
    setActiveSectionIndex(0);
  }, [selectedScript?.id]);

  useEffect(() => {
    if (suggestedSectionIndex > activeSectionIndex) {
      setActiveSectionIndex(suggestedSectionIndex);
    }
  }, [activeSectionIndex, suggestedSectionIndex]);

  if (assistMode !== 'script') {
    return null;
  }

  if (!selectedScript || selectedScriptSections.length === 0) {
    return (
      <StyledPanel>
        <StyledEmpty>
          <IconScript size={20} />
          <span>{t`Select a script in AI settings to guide the call.`}</span>
        </StyledEmpty>
      </StyledPanel>
    );
  }

  const currentSection = selectedScriptSections[activeSectionIndex];
  const nextSection = selectedScriptSections[activeSectionIndex + 1] ?? null;

  return (
    <StyledPanel>
      <StyledHeader>
        <StyledTitleGroup>
          <StyledEyebrow>{t`Script mode`}</StyledEyebrow>
          <StyledTitle>{selectedScript.name}</StyledTitle>
        </StyledTitleGroup>
        <StyledControls>
          <StyledControlButton
            disabled={activeSectionIndex === 0}
            onClick={() =>
              setActiveSectionIndex((previous) => Math.max(0, previous - 1))
            }
          >
            <IconChevronLeft size={16} />
            {t`Back`}
          </StyledControlButton>
          <StyledControlButton
            disabled={activeSectionIndex >= selectedScriptSections.length - 1}
            onClick={() =>
              setActiveSectionIndex((previous) =>
                Math.min(selectedScriptSections.length - 1, previous + 1),
              )
            }
          >
            {t`Next`}
            <IconChevronRight size={16} />
          </StyledControlButton>
        </StyledControls>
      </StyledHeader>

      <StyledCurrentSection>
        <StyledEyebrow>{t`Current section`}</StyledEyebrow>
        <StyledCurrentTitle>{currentSection.title}</StyledCurrentTitle>
        <StyledBody>{currentSection.body}</StyledBody>
      </StyledCurrentSection>

      {nextSection && (
        <StyledNextSection>
          <StyledNextTitle>{t`Up next`}</StyledNextTitle>
          <StyledPreview>
            <strong>{nextSection.title}</strong>
            {` - ${nextSection.preview}`}
          </StyledPreview>
        </StyledNextSection>
      )}
    </StyledPanel>
  );
};
