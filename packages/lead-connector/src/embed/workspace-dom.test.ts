import { describe, expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';
import { replaceWorkspace, createInteractionRenderer } from './workspace-dom';
describe('snapshot redraws', () => {
  it('keeps drafts, focus, selection and disclosures while fresh state arrives', () => {
    const document = new JSDOM('<main id="root"></main>', {
      pretendToBeVisual: true,
    }).window.document;
    const root = document.querySelector<HTMLElement>('#root')!;
    const html =
      '<details data-disclosure="options"><summary>Options</summary><input data-field="single-phone" type="tel" value=""></details>';
    replaceWorkspace(root, html);
    const input = root.querySelector<HTMLInputElement>('input')!;
    root.querySelector('details')!.open = true;
    input.value = '+15550101234';
    input.focus();
    input.setSelectionRange(3, 5);
    replaceWorkspace(root, html);
    expect(root.querySelector<HTMLInputElement>('input')!.value).toBe(
      '+15550101234',
    );
    expect(document.activeElement).toBe(root.querySelector('input'));
    expect(root.querySelector<HTMLInputElement>('input')!.selectionStart).toBe(
      3,
    );
    expect(root.querySelector('details')!.open).toBe(true);
    replaceWorkspace(
      root,
      html.replace('value=""', 'value="new controlled value"'),
    );
    expect(root.querySelector<HTMLInputElement>('input')!.value).toBe(
      'new controlled value',
    );
    document.defaultView!.close();
  });
  it('does not resurrect a submitted setup code after the handler clears it', () => {
    const document = new JSDOM(
      '<main id="root"><form data-form="commercial-purchase-claim"><input name="setupCode" type="password" value=""></form></main>',
    ).window.document;
    const root = document.querySelector<HTMLElement>('#root')!;
    const html = root.innerHTML;
    root.querySelector<HTMLInputElement>('input')!.value = 'private-setup-code';
    root.querySelector<HTMLInputElement>('input')!.value = '';
    replaceWorkspace(root, html);
    expect(root.querySelector<HTMLInputElement>('input')!.value).toBe('');
    document.defaultView!.close();
  });
  it('preserves a pressed button through a concurrent refresh so its click still commits once', async () => {
    const document = new JSDOM('<main id="root"></main>', {
      pretendToBeVisual: true,
    }).window.document;
    const root = document.querySelector<HTMLElement>('#root')!;
    let paints = 0,
      clicks = 0;
    const renderer = createInteractionRenderer(root, () => {
      paints++;
      replaceWorkspace(root, '<button data-action="start">Start</button>');
    });
    root.addEventListener('click', () => {
      clicks++;
    });
    renderer.render();
    const button = root.querySelector('button')!;
    button.dispatchEvent(
      new document.defaultView!.Event('pointerdown', { bubbles: true }),
    );
    renderer.render();
    expect(root.querySelector('button')).toBe(button);
    button.dispatchEvent(
      new document.defaultView!.Event('pointerup', { bubbles: true }),
    );
    button.click();
    await new Promise((resolve) =>
      document.defaultView!.setTimeout(resolve, 10),
    );
    expect(clicks).toBe(1);
    expect(paints).toBe(2);
    renderer.dispose();
    document.defaultView!.close();
  });
  it('keeps disposition, endpoint choices and the open keyboard picker across a snapshot refresh', () => {
    const document = new JSDOM('<main id="root"></main>', {
      pretendToBeVisual: true,
    }).window.document;
    const root = document.querySelector<HTMLElement>('#root')!;
    const html =
      '<form data-form="wrap-up"><select name="disposition"><option value="connected">Connected</option><option value="follow-up">Follow up</option></select></form><input type="checkbox" data-field="inbound-endpoint" data-endpoint-id="phone"><div data-combobox-field="queue" data-combobox-value=""><button role="combobox" aria-expanded="false"></button><div role="listbox"><button role="option" data-combobox-value="queue-a">Sales</button></div></div>';
    replaceWorkspace(root, html);
    root.querySelector<HTMLSelectElement>('select')!.value = 'follow-up';
    root.querySelector<HTMLInputElement>('input')!.checked = true;
    const trigger = root.querySelector<HTMLElement>('[role=combobox]')!;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.focus();
    replaceWorkspace(root, html);
    expect(root.querySelector<HTMLSelectElement>('select')!.value).toBe(
      'follow-up',
    );
    expect(root.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
    expect(
      root.querySelector('[role=combobox]')!.getAttribute('aria-expanded'),
    ).toBe('true');
    expect(document.activeElement).toBe(root.querySelector('[role=combobox]'));
    document.defaultView!.close();
  });
  it('keeps a phone selection through consecutive loading/loaded refreshes without changing checkbox defaults', () => {
    const document = new JSDOM('<main id="root"></main>').window.document;
    const root = document.querySelector<HTMLElement>('#root')!;
    const html =
      '<input type="checkbox" data-field="inbound-endpoint" data-endpoint-id="phone">';
    replaceWorkspace(root, html);
    root.querySelector<HTMLInputElement>('input')!.checked = true;
    for (let n = 0; n < 4; n++) {
      replaceWorkspace(root, html);
      expect(root.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
      expect(root.querySelector<HTMLInputElement>('input')!.defaultValue).toBe(
        '',
      );
    }
    document.defaultView!.close();
  });
});

it('preserves the current page scroll during polling and resets it for navigation', () => {
  const document = new JSDOM('<div id="app"></div>').window.document;
  const root = document.querySelector<HTMLElement>('#app')!;
  const markup = (screen: string) =>
    '<main data-workspace data-workspace-screen="' +
    screen +
    '"><div class="workspace-content"><p>Content</p></div></main>';
  replaceWorkspace(root, markup('billing'));
  root.querySelector<HTMLElement>('.workspace-content')!.scrollTop = 180;
  replaceWorkspace(root, markup('billing'));
  expect(root.querySelector<HTMLElement>('.workspace-content')!.scrollTop).toBe(
    180,
  );
  replaceWorkspace(root, markup('settings'));
  expect(root.querySelector<HTMLElement>('.workspace-content')!.scrollTop).toBe(
    0,
  );
});

it('never restores a browser file-picker value during a snapshot redraw',()=>{
 const document=new JSDOM('<div id="app"></div>').window.document;
 const root=document.querySelector<HTMLElement>('#app')!;
 const markup='<form data-form="coaching-script"><input type="file" data-field="script-file" /></form>';
 replaceWorkspace(root,markup);
 Object.defineProperty(root.querySelector('input')!,'value',{value:'C:\\fakepath\\playbook.md',configurable:true});
 expect(()=>replaceWorkspace(root,markup)).not.toThrow();
 expect(root.querySelector<HTMLInputElement>('input')!.value).toBe('');
});
