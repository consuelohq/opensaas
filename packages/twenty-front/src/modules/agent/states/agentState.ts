import { createState } from '@/ui/utilities/state/utils/createState';

export const agentSidebarCollapsedState = createState<boolean>({
  key: 'agentSidebarCollapsedState',
  defaultValue: false,
});

export const agentContextPanelCollapsedState = createState<boolean>({
  key: 'agentContextPanelCollapsedState',
  defaultValue: false,
});

export const selectedSkillIdState = createState<string | null>({
  key: 'selectedSkillIdState',
  defaultValue: null,
});
