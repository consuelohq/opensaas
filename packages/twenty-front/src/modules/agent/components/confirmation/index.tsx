import { makeAssistantToolUI } from '@assistant-ui/react';

import { AgentActionCard } from '@/agent/components/confirmation/AgentActionCard';
import { BatchConfirmationBar } from '@/agent/components/confirmation/BatchConfirmationBar';

// CRM tools that require user confirmation before execution
const CRM_TOOL_NAMES = [
  'log_call',
  'update_deal',
  'create_task',
  'send_email',
] as const;

// creates a makeAssistantToolUI component for a single CRM tool
const createCrmToolUI = (toolName: string) =>
  makeAssistantToolUI<Record<string, unknown>, string>({
    toolName,
    render: function CrmToolUI({ args, result, status, addResult }) {
      return (
        <AgentActionCard
          toolName={toolName}
          args={args}
          status={status.type}
          result={result}
          onApprove={() => addResult(JSON.stringify({ approved: true }))}
          onSkip={() =>
            addResult(JSON.stringify({ approved: false, skipped: true }))
          }
        />
      );
    },
  });

// registered tool UI components — pass these to <Thread tools={[...]} />
export const crmConfirmationToolUIs = CRM_TOOL_NAMES.map(createCrmToolUI);

export { AgentActionCard, BatchConfirmationBar };
