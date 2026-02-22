import styled from '@emotion/styled';
import { IconFile, IconDownload } from '@tabler/icons-react';

type FileCardInput = {
  fileName: string;
  fileUrl: string;
  fileSize?: string;
  mimeType?: string;
};

type AgentFileCardProps = {
  input: FileCardInput;
};

const StyledCard = styled.a`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.primary};
  text-decoration: none;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.transparent.light};
  color: ${({ theme }) => theme.font.color.secondary};
  flex-shrink: 0;
`;

const StyledInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const StyledFileName = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledMeta = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledDownload = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  flex-shrink: 0;
`;

export const AgentFileCard = ({ input }: AgentFileCardProps) => {
  const { fileName, fileUrl, fileSize, mimeType } = input;

  const meta = [mimeType, fileSize].filter(Boolean).join(' · ');

  return (
    <StyledCard href={fileUrl} target="_blank" rel="noopener noreferrer">
      <StyledIcon>
        <IconFile size={20} />
      </StyledIcon>
      <StyledInfo>
        <StyledFileName>{fileName}</StyledFileName>
        {meta && <StyledMeta>{meta}</StyledMeta>}
      </StyledInfo>
      <StyledDownload>
        <IconDownload size={16} />
      </StyledDownload>
    </StyledCard>
  );
};
