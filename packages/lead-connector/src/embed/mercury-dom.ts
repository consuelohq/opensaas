// Only this cue region is retained. Call controls remain rendered from current authority.
export const reconcileMercuryCue = (
  previous: HTMLElement,
  next: HTMLElement,
): void => {
  if (previous.dataset.mercuryScope !== next.dataset.mercuryScope) return;
  for (const slot of next.querySelectorAll<HTMLElement>('[data-cue-slot]')) {
    const old = [
      ...previous.querySelectorAll<HTMLElement>('[data-cue-slot]'),
    ].find((candidate) => candidate.dataset.cueSlot === slot.dataset.cueSlot);
    if (
      old?.textContent === slot.textContent &&
      old.getAttribute('aria-hidden') === slot.getAttribute('aria-hidden')
    ) {
      old.removeAttribute('data-cue-changed');
      slot.replaceWith(old);
    } else if (old) {
      slot.setAttribute('data-cue-changed', '');
    }
  }
  const oldSource = previous.querySelector<HTMLDetailsElement>(
    '[data-disclosure="mercury-source"]',
  );
  const newSource = next.querySelector<HTMLDetailsElement>(
    '[data-disclosure="mercury-source"]',
  );
  if (oldSource && newSource) {
    newSource.open = oldSource.open;
    if (oldSource.innerHTML === newSource.innerHTML)
      newSource.replaceWith(oldSource);
  }
};
