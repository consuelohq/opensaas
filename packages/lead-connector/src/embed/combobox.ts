export type ComboboxOption = { value: string; label: string };

export type ComboboxInput = {
  root: HTMLElement;
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const createCombobox = (input: ComboboxInput) => {
  const trigger = input.root.querySelector<HTMLElement>('[role="combobox"]');
  const listbox = input.root.querySelector<HTMLElement>('[role="listbox"]');
  if (!trigger || !listbox) throw new Error('Combobox markup is incomplete');

  let options = input.options;
  let value = input.value;
  let open = trigger.getAttribute('aria-expanded') === 'true';
  let activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const render = (): void => {
    listbox.innerHTML = options
      .map(
        (option, index) =>
          `<button type="button" id="${listbox.id || 'combobox'}-option-${index}" class="combobox__option${index === activeIndex ? ' is-active' : ''}" role="option" data-combobox-value="${escapeHtml(option.value)}" aria-selected="${option.value === value}">${escapeHtml(option.label)}</button>`,
      )
      .join('');
    const selected = options.find((option) => option.value === value);
    if (selected) trigger.textContent = selected.label;
    trigger.setAttribute('aria-expanded', String(open));
    listbox.hidden = !open;
    const active = listbox.querySelector<HTMLElement>(
      `[id$="-option-${activeIndex}"]`,
    );
    if (open && active) {
      trigger.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView?.({ block: 'nearest' });
    } else {
      trigger.removeAttribute('aria-activedescendant');
    }
  };

  const setOpen = (next: boolean): void => {
    open = next;
    render();
  };

  const select = (index: number): void => {
    const option = options[index];
    if (!option) return;
    value = option.value;
    activeIndex = index;
    input.onChange(option.value);
    setOpen(false);
    trigger.focus();
  };

  const move = (index: number): void => {
    if (options.length === 0) return;
    activeIndex = Math.max(0, Math.min(index, options.length - 1));
    open = true;
    render();
  };

  const onTriggerClick = (): void => setOpen(!open);
  const onRootClick = (event: Event): void => {
    const target = event.target as Element | null;
    const option = target?.closest<HTMLElement>('[role="option"]');
    if (!option || !input.root.contains(option)) return;
    const index = options.findIndex(
      (candidate) => candidate.value === option.dataset.comboboxValue,
    );
    select(index);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(open ? activeIndex + 1 : activeIndex);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(open ? activeIndex - 1 : activeIndex);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      move(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      move(options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) select(activeIndex);
      else setOpen(true);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.focus();
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const query = event.key.toLocaleLowerCase();
      const match = options.findIndex((option) =>
        option.label.toLocaleLowerCase().startsWith(query),
      );
      if (match >= 0) move(match);
    }
  };

  trigger.addEventListener('click', onTriggerClick);
  trigger.addEventListener('keydown', onKeyDown);
  input.root.addEventListener('click', onRootClick);
  render();

  return {
    update: (next: { options: ComboboxOption[]; value: string | null }) => {
      options = next.options;
      value = next.value;
      const selectedIndex = options.findIndex(
        (option) => option.value === value,
      );
      if (!open && selectedIndex >= 0) activeIndex = selectedIndex;
      activeIndex = Math.min(activeIndex, Math.max(0, options.length - 1));
      render();
    },
    destroy: () => {
      trigger.removeEventListener('click', onTriggerClick);
      trigger.removeEventListener('keydown', onKeyDown);
      input.root.removeEventListener('click', onRootClick);
    },
  };
};
