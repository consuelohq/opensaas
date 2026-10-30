type DraftField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const originalValue = (field: DraftField): string =>
  field.tagName === 'SELECT'
    ? [...(field as HTMLSelectElement).options]
        .map((o) => o.value + ':' + o.defaultSelected)
        .join('|')
    : (field as HTMLInputElement | HTMLTextAreaElement).defaultValue;

/** Retain in-memory edits across snapshot redraws; never persist form values. */
export const replaceWorkspace = (root: HTMLElement, html: string): void => {
  const key = (element: Element) => {
    const form = element.closest('form')?.getAttribute('data-form') ?? '';
    return (
      form +
      ':' +
      (element.getAttribute('data-field') ??
        element.getAttribute('name') ??
        '') +
      ':' +
      (element.getAttribute('data-endpoint-id') ?? '')
    );
  };
  const fields = [
    ...root.querySelectorAll<DraftField>('input, textarea, select'),
  ];
  const drafts = new Map(
    fields.map((e) => [
      key(e),
      {
        value: e.value,
        original: originalValue(e),
        checked: 'checked' in e ? e.checked : null,
        defaultChecked: 'defaultChecked' in e ? e.defaultChecked : null,
        focused: e === e.ownerDocument.activeElement,
        start: 'selectionStart' in e ? e.selectionStart : null,
        end: 'selectionEnd' in e ? e.selectionEnd : null,
      },
    ]),
  );
  const disclosures = new Map(
    [
      ...root.querySelectorAll<HTMLDetailsElement>('details[data-disclosure]'),
    ].map((e) => [e.dataset.disclosure, e.open]),
  );
  const pickers = new Map(
    [...root.querySelectorAll<HTMLElement>('[data-combobox-field]')].map(
      (e) => {
        const trigger = e.querySelector<HTMLElement>('[role=combobox]');
        const activeId = trigger?.getAttribute('aria-activedescendant');
        return [
          e.dataset.comboboxField,
          {
            value: e.dataset.comboboxValue,
            open: trigger?.getAttribute('aria-expanded') === 'true',
            focused: trigger === root.ownerDocument.activeElement,
            activeValue: activeId
              ? root.ownerDocument.getElementById(activeId)?.dataset
                  .comboboxValue
              : undefined,
          },
        ];
      },
    ),
  );
  const focusedAction = (root.ownerDocument.activeElement as HTMLElement | null)
    ?.dataset.action;
  root.innerHTML = html;
  for (const field of root.querySelectorAll<DraftField>(
    'input, textarea, select',
  )) {
    const old = drafts.get(key(field));
    if (!old || old.original !== originalValue(field)) continue;
    if (
      field.tagName !== 'SELECT' ||
      [...(field as HTMLSelectElement).options].some(
        (o) => o.value === old.value,
      )
    )
      field.value = old.value;
    if (
      'checked' in field &&
      !field.disabled &&
      field.defaultChecked === old.defaultChecked &&
      old.checked !== null
    )
      field.checked = old.checked;
    if (old.focused) {
      field.focus({ preventScroll: true });
      if (
        old.start !== null &&
        old.end !== null &&
        'setSelectionRange' in field &&
        (field.tagName === 'TEXTAREA' ||
          ['text', 'search', 'tel', 'password'].includes(
            (field as HTMLInputElement).type,
          ))
      )
        field.setSelectionRange(old.start, old.end);
    }
  }
  for (const disclosure of root.querySelectorAll<HTMLDetailsElement>(
    'details[data-disclosure]',
  )) {
    const open = disclosures.get(disclosure.dataset.disclosure);
    if (open !== undefined) disclosure.open = open;
  }
  for (const picker of root.querySelectorAll<HTMLElement>(
    '[data-combobox-field]',
  )) {
    const old = pickers.get(picker.dataset.comboboxField);
    if (!old || old.value !== picker.dataset.comboboxValue) continue;
    const trigger = picker.querySelector<HTMLElement>('[role=combobox]');
    if (old.open) trigger?.setAttribute('aria-expanded', 'true');
    if (old.activeValue) picker.dataset.activeValue = old.activeValue;
    if (old.focused) trigger?.focus({ preventScroll: true });
  }
  if (
    focusedAction &&
    !root.contains(root.ownerDocument.activeElement) &&
    /^[a-z-]+$/.test(focusedAction)
  )
    root
      .querySelector<HTMLElement>('[data-action="' + focusedAction + '"]')
      ?.focus({ preventScroll: true });
};

/** Keep a pointer's target mounted through click dispatch while snapshots arrive. */
export const createInteractionRenderer = (
  root: HTMLElement,
  paint: () => void,
) => {
  const host = root.ownerDocument.defaultView!;
  let pressed = false;
  let queued = false;
  let timer: number | undefined;
  const flush = () => {
    pressed = false;
    if (queued) {
      queued = false;
      paint();
    }
  };
  const down = () => {
    pressed = true;
    if (timer !== undefined) host.clearTimeout(timer);
    timer = host.setTimeout(flush, 1000);
  };
  const up = () => {
    if (timer !== undefined) host.clearTimeout(timer);
    timer = host.setTimeout(flush, 0);
  };
  root.addEventListener('pointerdown', down, true);
  host.addEventListener('pointerup', up, true);
  host.addEventListener('pointercancel', up, true);
  host.addEventListener('blur', up);
  return {
    render: () => {
      if (pressed) queued = true;
      else paint();
    },
    dispose: () => {
      if (timer !== undefined) host.clearTimeout(timer);
      root.removeEventListener('pointerdown', down, true);
      host.removeEventListener('pointerup', up, true);
      host.removeEventListener('pointercancel', up, true);
      host.removeEventListener('blur', up);
    },
  };
};
