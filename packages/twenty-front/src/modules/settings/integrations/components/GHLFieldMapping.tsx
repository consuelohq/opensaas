/**
 * GHL Field Mapping Component
 * Manages field mappings between GHL and Twenty CRM
 * DEV-785: GHL Settings UI
 */

import { useRecoilValue } from 'recoil';
import styled from '@emotion/styled';
import { Card, CardContent, Section } from 'twenty-ui/layout';

import { ghlFieldMappingsState } from '@/settings/integrations/states/ghlFieldMappingsState';

type GHLFieldMappingProps = {
  title: string;
  description: string;
};

const StyledSection = styled(Section)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledCard = styled(Card)`
  overflow: hidden;
`;

const StyledCardContent = styled(CardContent)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledDescription = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0;
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(6)};
`;

export const GHLFieldMapping = ({
  title,
  description,
}: GHLFieldMappingProps) => {
  const fieldMappings = useRecoilValue(ghlFieldMappingsState);

  return (
    <StyledSection>
      <h2>{title}</h2>
      <StyledDescription>{description}</StyledDescription>
      <StyledCard rounded>
        <StyledCardContent>
          {fieldMappings.length === 0 ? (
            <StyledEmptyState>
              No field mappings configured. Field mapping will be available
              after connecting your GHL account.
            </StyledEmptyState>
          ) : (
            <StyledEmptyState>
              {fieldMappings.length} field mapping(s) configured.
            </StyledEmptyState>
          )}
        </StyledCardContent>
      </StyledCard>
    </StyledSection>
  );
};
