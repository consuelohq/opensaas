/**
 * GHL Pipeline Mapping Component
 * Maps GHL pipeline stages to Twenty CRM pipeline stages
 * DEV-1094: GHL Pipeline Mapping UI
 */

import { useCallback, useEffect, useState } from 'react';

import { useRecoilValue } from 'recoil';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {
  IconAlertCircle,
  IconArrowRight,
  IconDeviceFloppy,
  IconRefresh,
} from '@tabler/icons-react';
import { Button } from 'twenty-ui/input';
import { Card, CardContent, Section } from 'twenty-ui/layout';

import { ghlPipelineMappingsState } from '@/settings/integrations/states/ghlPipelineMappingsState';
import { useGHLPipelineMappings } from '@/settings/integrations/hooks/useGHLPipelineMappings';
import type { GHLPipelineStageMapping } from '@/settings/integrations/types/ghl';

type GHLPipelineMappingProps = {
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

const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;
`;

const StyledTh = styled.th`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  text-align: left;
`;

const StyledTd = styled.td`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  vertical-align: middle;
`;

const StyledRow = styled.tr`
  &:last-child td {
    border-bottom: none;
  }
`;

const StyledArrowCell = styled(StyledTd)`
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
  width: 40px;
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
  width: 100%;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const StyledPipelineLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledButtonGroup = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(6)};
`;

const StyledErrorContainer = styled.div`
  align-items: center;
  background: rgba(239, 68, 68, 0.1);
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.color.red};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

export const GHLPipelineMapping = ({
  title,
  description,
}: GHLPipelineMappingProps) => {
  const ghlPipelineMappings = useRecoilValue(ghlPipelineMappingsState);
  const {
    ghlStages,
    twentyStages,
    isLoading,
    isSaving,
    isSyncing,
    error,
    fetchPipelines,
    fetchMappings,
    saveMappings,
    triggerSync,
  } = useGHLPipelineMappings();

  // local draft state for unsaved changes
  const [draftMappings, setDraftMappings] = useState<
    Map<string, string | null>
  >(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchPipelines();
        await fetchMappings();
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: { component: 'GHLPipelineMapping', operation: 'loadData' },
        });
      }
    };

    void loadData();
  }, [fetchPipelines, fetchMappings]);

  // sync saved mappings into draft state
  useEffect(() => {
    const map = new Map<string, string | null>();

    for (const mapping of savedMappings) {
      map.set(mapping.ghlStageId, mapping.twentyStageId);
    }

    setDraftMappings(map);
    setHasChanges(false);
  }, [savedMappings]);

  const handleMappingChange = useCallback(
    (ghlStageId: string, twentyStageId: string | null) => {
      setDraftMappings((prev) => {
        const next = new Map(prev);

        next.set(ghlStageId, twentyStageId);

        return next;
      });
      setHasChanges(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    try {
      const mappings: GHLPipelineStageMapping[] = ghlStages.map((stage) => {
        const twentyStageId = draftMappings.get(stage.id) ?? null;
        const twentyStage = twentyStages.find((s) => s.id === twentyStageId);

        return {
          ghlStageId: stage.id,
          ghlStageName: stage.name,
          ghlPipelineId: stage.pipelineId,
          ghlPipelineName: stage.pipelineName,
          twentyStageId,
          twentyStageName: twentyStage?.name ?? null,
        };
      });

      await saveMappings(mappings);
      setHasChanges(false);
    } catch (err: unknown) {
      Sentry.captureException(err, {
        tags: { component: 'GHLPipelineMapping', operation: 'handleSave' },
      });
    }
  }, [ghlStages, twentyStages, draftMappings, saveMappings]);

  const handleSync = useCallback(async () => {
    try {
      await triggerSync();
    } catch (err: unknown) {
      Sentry.captureException(err, {
        tags: { component: 'GHLPipelineMapping', operation: 'handleSync' },
      });
    }
  }, [triggerSync]);

  return (
    <StyledSection>
      <h2>{title}</h2>
      <StyledDescription>{description}</StyledDescription>

      {error && (
        <StyledErrorContainer>
          <IconAlertCircle size={16} />
          <span>{error}</span>
        </StyledErrorContainer>
      )}

      <StyledCard rounded>
        <StyledCardContent>
          {isLoading ? (
            <StyledEmptyState>Loading pipelines...</StyledEmptyState>
          ) : ghlStages.length === 0 ? (
            <StyledEmptyState>
              No GHL pipeline stages found. Connect your GHL account to see
              pipelines.
            </StyledEmptyState>
          ) : (
            <StyledTable>
              <thead>
                <tr>
                  <StyledTh>GHL Stage</StyledTh>
                  <StyledTh />
                  <StyledTh>Consuelo Stage</StyledTh>
                </tr>
              </thead>
              <tbody>
                {ghlStages.map((stage) => (
                  <StyledRow key={stage.id}>
                    <StyledTd>
                      {stage.name}
                      <br />
                      <StyledPipelineLabel>
                        {stage.pipelineName}
                      </StyledPipelineLabel>
                    </StyledTd>
                    <StyledArrowCell>
                      <IconArrowRight size={16} />
                    </StyledArrowCell>
                    <StyledTd>
                      <StyledSelect
                        value={draftMappings.get(stage.id) ?? ''}
                        onChange={(event) =>
                          handleMappingChange(
                            stage.id,
                            event.target.value || null,
                          )
                        }
                        disabled={isSaving}
                      >
                        <option value="">Select...</option>
                        {twentyStages.map((twentyStage) => (
                          <option key={twentyStage.id} value={twentyStage.id}>
                            {twentyStage.name}
                          </option>
                        ))}
                      </StyledSelect>
                    </StyledTd>
                  </StyledRow>
                ))}
              </tbody>
            </StyledTable>
          )}

          <StyledButtonGroup>
            <Button
              title={isSaving ? 'Saving...' : 'Save Mappings'}
              Icon={IconDeviceFloppy}
              variant="primary"
              onClick={handleSave}
              disabled={isSaving || isLoading || !hasChanges}
            />
            <Button
              title={isSyncing ? 'Syncing...' : 'Sync Pipelines'}
              Icon={IconRefresh}
              variant="secondary"
              onClick={handleSync}
              disabled={isSyncing || isLoading}
            />
          </StyledButtonGroup>
        </StyledCardContent>
      </StyledCard>
    </StyledSection>
  );
};
