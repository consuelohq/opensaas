import styled from '@emotion/styled';

import { Modal } from '@/ui/layout/modal/components/Modal';

export const StyledImportListNameModalContent = styled(Modal.Content)`
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(5)};
`;

export const StyledImportListNameModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
`;

export const StyledImportListNameModalHeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

export const StyledImportListNameModalTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: 0;
`;

export const StyledImportListNameModalSubtitle = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.4;
  margin: 0;
`;

export const StyledImportListNameModalFooter = styled(Modal.Footer)`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing(0, 5, 4, 5)};
`;
