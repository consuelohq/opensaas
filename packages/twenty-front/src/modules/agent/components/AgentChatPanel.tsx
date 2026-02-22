import styled from '@emotion/styled';

const StyledContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.tertiary};
`;

export const AgentChatPanel = () => {
  return <StyledContainer>Chat</StyledContainer>;
};
