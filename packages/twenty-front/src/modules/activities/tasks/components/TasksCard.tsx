import styled from '@emotion/styled';

import { TaskGroups } from '@/activities/tasks/components/TaskGroups';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { TabListComponentInstanceContext } from '@/ui/layout/tab-list/states/contexts/TabListComponentInstanceContext';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`;

export const TasksCard = () => {
  const targetRecord = useTargetRecord();
  const tasksTabListInstanceId = `entity-tasks-tab-list-${targetRecord.id}`;

  return (
    <StyledContainer>
      <TabListComponentInstanceContext.Provider
        value={{ instanceId: tasksTabListInstanceId }}
      >
        <ObjectFilterDropdownComponentInstanceContext.Provider
          value={{ instanceId: 'entity-tasks-filter-instance' }}
        >
          <TaskGroups targetableObject={targetRecord} />
        </ObjectFilterDropdownComponentInstanceContext.Provider>
      </TabListComponentInstanceContext.Provider>
    </StyledContainer>
  );
};
