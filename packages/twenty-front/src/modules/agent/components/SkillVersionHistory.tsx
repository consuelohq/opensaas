import styled from '@emotion/styled';
import { useCallback } from 'react';

import { REST_API_BASE_URL } from '@/apollo/constant/rest-api-base-url';
import { getTokenPair } from '@/apollo/utils/getTokenPair';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledVersionRow = styled.div`
  align-items: center;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledVersionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledVersionNumber = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledMeta = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledRollbackButton = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledDiffPlaceholder = styled.div`
  align-items: center;
  border: 1px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: center;
  min-height: 200px;
`;

const StyledEmpty = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

type VersionItem = {
  id: string;
  version: number;
  changeSummary: string | null;
  createdAt: string;
};

type SkillVersionHistoryProps = {
  skillId: string;
  versions: VersionItem[];
  onVersionClick?: (version: VersionItem) => void;
  onRollbackComplete?: () => void;
};

export const SkillVersionHistory = ({
  skillId,
  versions,
  onVersionClick,
  onRollbackComplete,
}: SkillVersionHistoryProps) => {
  const handleRollback = useCallback(
    async (version: number) => {
      const tokenPair = getTokenPair();

      if (!tokenPair) {
        return;
      }

      try {
        const response = await fetch(
          `${REST_API_BASE_URL}/v1/agent/skills/${skillId}/versions/${version}/rollback`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
            },
          },
        );

        if (response.ok) {
          onRollbackComplete?.();
        }
      } catch {
        // NOTE: rollback error handling wired in follow-up
      }
    },
    [skillId, onRollbackComplete],
  );

  if (versions.length === 0) {
    return <StyledEmpty>No versions yet</StyledEmpty>;
  }

  return (
    <StyledContainer>
      {/* MonacoDiffEditor integration — requires @monaco-editor/react install */}
      <StyledDiffPlaceholder>
        Diff viewer — MonacoDiffEditor placeholder
      </StyledDiffPlaceholder>

      {versions.map((v) => (
        <StyledVersionRow key={v.id} onClick={() => onVersionClick?.(v)}>
          <StyledVersionInfo>
            <StyledVersionNumber>v{v.version}</StyledVersionNumber>
            <StyledMeta>
              {v.changeSummary ?? 'No summary'} ·{' '}
              {new Date(v.createdAt).toLocaleDateString()}
            </StyledMeta>
          </StyledVersionInfo>
          <StyledRollbackButton
            onClick={(e) => {
              e.stopPropagation();
              void handleRollback(v.version);
            }}
          >
            Rollback
          </StyledRollbackButton>
        </StyledVersionRow>
      ))}
    </StyledContainer>
  );
};
