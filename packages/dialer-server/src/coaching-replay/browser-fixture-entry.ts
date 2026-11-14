import {
  createMercuryAuthoringApi,
  renderMercuryPublication,
  type MercuryPublication,
} from '../../../lead-connector/src/embed/mercury-authoring';
import { createMercuryAuthoringController } from '../../../lead-connector/src/embed/mercury-authoring-controller';
import {
  readScriptFile,
  type CoachingScript,
} from '../../../lead-connector/src/embed/coaching-scripts';
import { replaceWorkspace } from '../../../lead-connector/src/embed/workspace-dom';

const root = document.querySelector<HTMLElement>('#fixture')!;
const api = createMercuryAuthoringApi({
  baseUrl: location.origin,
  getToken: () => 'fixture-rep',
});
let scripts: CoachingScript[] = [],
  selected = '',
  publication: MercuryPublication | undefined,
  counter = 0;
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const render = () => {
  const script = scripts.find((x) => x.id === selected);
  replaceWorkspace(
    root,
    '<h1>Local authoring fixture</h1><p>Isolated component proof; fixture identity and database.</p>' +
      '<label>Saved script <select id="script-select">' +
      scripts
        .map(
          (x) =>
            '<option value="' +
            escape(x.id) +
            '"' +
            (x.id === selected ? ' selected' : '') +
            '>' +
            escape(x.title) +
            '</option>',
        )
        .join('') +
      '</select></label>' +
      '<form id="import"><label>Import text or Markdown <input type="file" name="file" accept=".txt,.md" required></label><button type="submit">Import and save</button></form>' +
      '<p id="fixture-error" role="alert"></p>' +
      (script
        ? renderMercuryPublication(script, publication)
        : '<p>No saved scripts.</p>'),
  );
};
const controller = createMercuryAuthoringController({
  api,
  getScript: (id) => scripts.find((x) => x.id === id),
  selectedScriptId: () => selected,
  getPublication: () => publication,
  setPublication: (p) => {
    publication = p;
  },
  nextRequestKey: () => ++counter,
  render,
});
async function reload() {
  try {
    const response = await fetch('/v1/coaching/scripts', {
      headers: { authorization: 'Bearer fixture-rep' },
    });
    if (!response.ok) throw new Error('Fixture scripts unavailable');
    scripts = (await response.json()).scripts;
    if (!scripts.some((x) => x.id === selected))
      selected = scripts[0]?.id ?? '';
    render();
  } catch (error: unknown) {
    throw error;
  }
}
root.addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLElement>(
    '[data-action]',
  );
  if (!target) return;
  if (target.dataset.action === 'script-preview')
    void controller.preview(target.dataset.scriptId!);
  if (target.dataset.action === 'script-example-triggers') {
    const form = target.closest<HTMLFormElement>('[data-trigger-review]');
    if (form) void controller.example(form);
  }
});
for (const kind of ['input', 'change'])
  root.addEventListener(kind, (event) => {
    const target = event.target as Element;
    controller.input(target);
    if (target.id === 'script-select') {
      selected = (target as HTMLSelectElement).value;
      publication = undefined;
      render();
    }
  });
root.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (form.matches('[data-trigger-review]')) void controller.review(form);
  else if (form.matches('[data-publication]')) void controller.publish(form);
  else if (form.id === 'import')
    void (async () => {
      try {
        const file = (form.elements.namedItem('file') as HTMLInputElement)
          .files?.[0];
        if (!file) throw new Error('Choose a file.');
        const draft = await readScriptFile(file),
          id = crypto.randomUUID();
        const result = await fetch('/v1/coaching/scripts/' + id, {
          method: 'PUT',
          headers: {
            authorization: 'Bearer fixture-rep',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ ...draft, expectedRevision: 0 }),
        });
        if (!result.ok) throw new Error('Could not save imported script.');
        selected = id;
        publication = undefined;
        await reload();
      } catch (error: unknown) {
        root.querySelector('#fixture-error')!.textContent = String(error);
      }
    })();
});
void reload();
