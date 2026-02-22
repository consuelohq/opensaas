import styled from '@emotion/styled';

type BriefSection = {
  heading: string;
  content: string;
};

type BriefInput = {
  title?: string;
  sections: Array<BriefSection>;
};

type AgentBriefRendererProps = {
  input: BriefInput;
};

const StyledWrapper = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledHeading = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledContent = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.6;
  white-space: pre-wrap;
`;

export const AgentBriefRenderer = ({ input }: AgentBriefRendererProps) => {
  const { title, sections } = input;

  return (
    <StyledWrapper>
      {title && <StyledTitle>{title}</StyledTitle>}
      {sections.map((section, index) => (
        <div key={index}>
          <StyledHeading>{section.heading}</StyledHeading>
          <StyledContent>{section.content}</StyledContent>
        </div>
      ))}
    </StyledWrapper>
  );
};
