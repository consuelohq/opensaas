import {
  IconBook2,
  IconDatabase,
  IconMail,
  IconTool,
  IconWorld,
} from 'twenty-ui/display';

const TOOL_ICON_MAPPINGS = [
  {
    keywords: ['learn_tools'],
    icon: IconBook2,
  },
  {
    keywords: ['email'],
    icon: IconMail,
  },
  {
    keywords: ['http_request'],
    icon: IconWorld,
  },
  {
    keywords: [
      'create_company',
      'create_person',
      'update_company',
      'update_person',
      'find_companies',
      'find_people',
      'delete_company',
      'delete_person',
      'search_contacts',
      'search_companies',
      'search_people',
      'get_company',
      'get_person',
      'list_companies',
      'list_people',
    ],
    icon: IconDatabase,
  },
  {
    keywords: ['workflow', 'handoff'],
    icon: IconTool,
  },
] as const;

export const getToolIcon = (toolName: string) => {
  const mapping = TOOL_ICON_MAPPINGS.find(({ keywords }) =>
    keywords.some((keyword) => toolName.includes(keyword)),
  );

  return mapping?.icon ?? IconTool;
};
