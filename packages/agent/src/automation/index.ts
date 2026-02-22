export type {
  Automation,
  CreateAutomationInput,
  TriggerConfig,
  ConditionGroup,
  Condition,
  CrmEventType,
  CrmEvent,
  TriggerEvalResult,
} from './automation.types.js';

export {
  evaluateCondition,
  evaluateConditionGroup,
  matchEventTrigger,
  matchConditionalTrigger,
  findMatchingAutomations,
  buildDebounceKey,
  parseCron,
} from './trigger.service.js';
