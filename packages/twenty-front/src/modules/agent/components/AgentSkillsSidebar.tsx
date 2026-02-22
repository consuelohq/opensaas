import styled from '@emotion/styled';

const StyledContainer = styled.div`
  width: 240px;
  min-width: 240px;
  border-right: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.tertiary};
`;

export const AgentSkillsSidebar = () => {
  return <StyledContainer>Skills</StyledContainer>;
};
