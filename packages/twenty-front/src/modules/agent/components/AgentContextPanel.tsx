import styled from '@emotion/styled';

const StyledContainer = styled.div`
  width: 280px;
  min-width: 280px;
  border-left: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.tertiary};

  @media (max-width: 1024px) {
    display: none;
  }
`;

export const AgentContextPanel = () => {
  return <StyledContainer>Context</StyledContainer>;
};
