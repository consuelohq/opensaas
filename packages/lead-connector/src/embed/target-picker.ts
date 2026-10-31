import type { LeadConnectorContact } from '../contracts/index.js';
import {
  normalizeClickToCallTarget,
  type LeadConnectorClickToCallTarget,
} from './protocol.js';
import { resolveLeadConnectorContactName } from './contact-label.js';
import { escapeHtml as e, formatPhone } from './workspace-format.js';
export const targetChoices = (
  contacts: LeadConnectorContact[],
  query: string,
): LeadConnectorClickToCallTarget[] => {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const matches = contacts
    .filter(
      (c) =>
        c.phone &&
        (!q ||
          [resolveLeadConnectorContactName(c), c.email, c.phone].some((v) =>
            v?.toLowerCase().includes(q),
          ) ||
          (digits.length > 0 && c.phone.replace(/\D/g, '').includes(digits))),
    )
    .flatMap((c) => {
      const target = normalizeClickToCallTarget({
        contactId: c.id,
        phone: c.phone!,
        name: resolveLeadConnectorContactName(c),
      });
      return target ? [target] : [];
    })
    .slice(0, 7);
  const manual = /^[+()\d\s.-]+$/.test(q)
    ? normalizeClickToCallTarget({ phone: q })
    : null;
  // Every choice has already crossed normalizeClickToCallTarget above.
  const canonicalPhones = new Set(matches.map((choice) => choice.phone));
  return manual && !canonicalPhones.has(manual.phone)
    ? [manual, ...matches]
    : matches;
};
export const renderTargetPicker = (input: {
  contacts: LeadConnectorContact[];
  query: string;
  open: boolean;
  active: number;
  selected?: LeadConnectorClickToCallTarget;
  selectedLabel?: string;
}): string => {
  const choices = targetChoices(input.contacts, input.query);
  const value = input.open
    ? input.query
    : (input.selectedLabel ??
      input.selected?.name ??
      (input.selected ? formatPhone(input.selected.phone) : ''));
  return `<label class="setup-field target-field"><span>Who do you want to call?</span><div class="target-picker"><input type="search" data-field="target-query" role="combobox" aria-controls="target-choices" aria-autocomplete="list" aria-expanded="${input.open}"${input.open && choices.length ? ` aria-activedescendant="target-option-${input.active}"` : ''} autocomplete="off" placeholder="Search a name or enter a phone number" value="${e(value)}"/><div class="target-picker__menu" id="target-choices" role="listbox"${input.open ? '' : ' hidden'}>${choices.map((c, i) => `<button type="button" role="option" aria-selected="${i === input.active}" id="target-option-${i}" data-action="choose-target" data-choice-index="${i}"><strong>${e(c.name ?? 'Call ' + formatPhone(c.phone))}</strong>${c.name ? `<small>${e(formatPhone(c.phone))}</small>` : '<small>Phone number</small>'}</button>`).join('') || '<p role="status">No matching contacts. You can enter a phone number.</p>'}</div></div></label>`;
};
