import { describe, expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';
import { createCombobox } from './combobox';
describe('compact calling choices', () => {
  it('closes on outside pointer and Tab focus exit, preserves selection, and removes listeners on destroy', () => {
    const { window } = new JSDOM(
      '<div id="root" data-combobox-value="auto"><button role="combobox" aria-expanded="false">Automatic</button><div role="listbox" id="choices" hidden></div></div><button id="outside">Outside</button>',
    );
    const root = window.document.querySelector<HTMLElement>('#root')!;
    const trigger = root.querySelector<HTMLButtonElement>('button')!;
    const changes: string[] = [];
    const menu = createCombobox({
      root,
      value: 'auto',
      options: [
        { value: 'auto', label: 'Automatic' },
        { value: 'number', label: 'My number' },
      ],
      onChange: (value) => changes.push(value),
    });
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    window.document
      .querySelector('#outside')!
      .dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    root.querySelectorAll<HTMLButtonElement>('[role=option]')[1]!.click();
    expect(changes).toEqual(['number']);
    expect(root.dataset.comboboxValue).toBe('number');
    expect(window.document.activeElement).toBe(trigger);
    trigger.click();
    trigger.focus();
    window.document.querySelector<HTMLButtonElement>('#outside')!.focus();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    menu.destroy();
    window.document
      .querySelector('#outside')!
      .dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    window.close();
  });
});
