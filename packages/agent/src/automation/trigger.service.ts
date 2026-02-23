import type {
  Automation,
  Condition,
  ConditionGroup,
  CrmEvent,
  TriggerConfig,
} from './automation.types.js';

// NOTE: all functions are pure — no side effects, no I/O

export function evaluateCondition(
  condition: Condition,
  payload: Record<string, unknown>,
): boolean {
  const fieldValue = payload[condition.field];

  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  const { operator, value } = condition;

  if (operator === 'contains' || operator === 'not_contains') {
    const strField = String(fieldValue);
    const strValue = String(value);
    const has = strField.includes(strValue);

    return operator === 'contains' ? has : !has;
  }

  // NOTE: coerce to number for numeric comparisons when both sides look numeric
  const numField = Number(fieldValue);
  const numValue = Number(value);
  const useNumeric = !Number.isNaN(numField) && !Number.isNaN(numValue);

  switch (operator) {
    case 'eq':
      return useNumeric ? numField === numValue : String(fieldValue) === String(value);
    case 'neq':
      return useNumeric ? numField !== numValue : String(fieldValue) !== String(value);
    case 'gt':
      return useNumeric && numField > numValue;
    case 'gte':
      return useNumeric && numField >= numValue;
    case 'lt':
      return useNumeric && numField < numValue;
    case 'lte':
      return useNumeric && numField <= numValue;
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup,
  payload: Record<string, unknown>,
): boolean {
  if (group.conditions.length === 0) {
    return true;
  }

  if (group.operator === 'and') {
    return group.conditions.every((c) => evaluateCondition(c, payload));
  }

  return group.conditions.some((c) => evaluateCondition(c, payload));
}

export function matchEventTrigger(
  trigger: TriggerConfig,
  event: CrmEvent,
): boolean {
  if (trigger.type !== 'event') {
    return false;
  }

  if (trigger.event !== event.type) {
    return false;
  }

  if (trigger.conditions) {
    return evaluateConditionGroup(trigger.conditions, event.payload);
  }

  return true;
}

export function matchConditionalTrigger(
  trigger: TriggerConfig,
  event: CrmEvent,
): boolean {
  if (trigger.type !== 'conditional') {
    return false;
  }

  if (trigger.event !== event.type) {
    return false;
  }

  return evaluateConditionGroup(trigger.conditions, event.payload);
}

export function findMatchingAutomations(
  automations: Automation[],
  event: CrmEvent,
): Automation[] {
  return automations.filter((a) => {
    if (!a.enabled) {
      return false;
    }

    return matchEventTrigger(a.trigger, event) || matchConditionalTrigger(a.trigger, event);
  });
}

export function buildDebounceKey(
  automationId: string,
  eventType: string,
): string {
  return `trigger:debounce:${automationId}:${eventType}`;
}

// NOTE: basic cron validation — checks field count and value ranges, not a full parser
const CRON_FIELD_RANGES: Array<{ name: string; min: number; max: number }> = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day of week', min: 0, max: 7 },
];

function isValidCronField(
  field: string,
  min: number,
  max: number,
): boolean {
  if (field === '*') {
    return true;
  }

  // handle step: */5 or 1-10/2
  const [range, step] = field.split('/');

  if (step !== undefined) {
    const stepNum = Number(step);

    if (Number.isNaN(stepNum) || stepNum < 1) {
      return false;
    }

    if (range === '*') {
      return true;
    }
  }

  const rangeToCheck = range ?? field;

  // handle comma-separated: 1,5,10
  const parts = rangeToCheck.split(',');

  for (const part of parts) {
    // handle range: 1-5
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Number(startStr);
      const end = Number(endStr);

      if (Number.isNaN(start) || Number.isNaN(end) || start < min || end > max || start > end) {
        return false;
      }

      continue;
    }

    const num = Number(part);

    if (Number.isNaN(num) || num < min || num > max) {
      return false;
    }
  }

  return true;
}

export function parseCron(
  expression: string,
): { valid: boolean; description?: string; error?: string } {
  const trimmed = expression.trim();
  const fields = trimmed.split(/\s+/);

  if (fields.length !== 5) {
    return { valid: false, error: `expected 5 fields, got ${fields.length}` };
  }

  for (let i = 0; i < fields.length; i++) {
    const range = CRON_FIELD_RANGES[i];

    if (!isValidCronField(fields[i], range.min, range.max)) {
      return { valid: false, error: `invalid ${range.name} field: ${fields[i]}` };
    }
  }

  return { valid: true, description: trimmed };
}
