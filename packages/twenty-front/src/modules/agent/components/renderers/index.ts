import { ComponentType } from 'react';

import { AgentBriefRenderer } from '@/agent/components/renderers/AgentBriefRenderer';
import { AgentChartRenderer } from '@/agent/components/renderers/AgentChartRenderer';
import { AgentFileCard } from '@/agent/components/renderers/AgentFileCard';
import { AgentTableRenderer } from '@/agent/components/renderers/AgentTableRenderer';

// maps server-side tool names to their renderer components
// each component receives { input } where input is the tool's args
export const toolRendererRegistry: Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HACK: tool input shapes vary per tool
  ComponentType<{ input: any }>
> = {
  render_chart: AgentChartRenderer,
  render_table: AgentTableRenderer,
  render_brief: AgentBriefRenderer,
  create_file: AgentFileCard,
};
