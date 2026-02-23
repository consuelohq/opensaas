import styled from '@emotion/styled';

const StyledContainer = styled.div`
  align-items: center;
  border-left: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  justify-content: center;
  min-width: 280px;
  overflow-y: auto;
  width: 280px;

  @media (max-width: 1024px) {
    display: none;
  }
`;

export const AgentContextPanel = () => {
  return <StyledContainer>Context</StyledContainer>;
};
