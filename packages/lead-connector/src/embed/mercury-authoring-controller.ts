import {
  editableMercuryRules,
  invalidateMercuryApproval,
  readMercuryTriggerForm,
  type createMercuryAuthoringApi,
  type MercuryPublication,
  type MercuryRule,
} from './mercury-authoring.js';
import type { CoachingScript } from './coaching-scripts.js';

/** The embed and isolated authoring proofs use these same guarded handlers. */
export const createMercuryAuthoringController = (options: {
  api: Pick<
    ReturnType<typeof createMercuryAuthoringApi>,
    'preview' | 'publish' | 'example'
  >;
  getScript: (id: string) => CoachingScript | undefined;
  selectedScriptId: () => string | undefined;
  getPublication: () => MercuryPublication | undefined;
  setPublication: (state: MercuryPublication) => void;
  nextRequestKey: () => number;
  render: () => void;
  onPublished?: () => Promise<unknown> | unknown;
}) => {
  const current = () => {
    const publication = options.getPublication();
    const script = options.getScript(options.selectedScriptId() ?? '');
    if (
      !publication?.preview ||
      publication.pending ||
      script?.canPublish !== true ||
      publication.scriptId !== script.id ||
      publication.savedRevision !== script.revision
    )
      return undefined;
    return { publication, script };
  };
  const controller = {
    async preview(
      id: string,
      rules?: MercuryRule[],
      exampleLabel?: string,
    ): Promise<void> {
      const script = options.getScript(id);
      if (script?.canPublish !== true || options.getPublication()?.pending)
        return;
      const prior = options.getPublication();
      const same =
        prior?.scriptId === id && prior.savedRevision === script.revision
          ? prior
          : undefined;
      const operation: MercuryPublication = {
        scriptId: id,
        savedRevision: script.revision,
        expectedPublishedVersion: 0,
        requestKey: options.nextRequestKey(),
        pending: true,
        exampleLabel,
        ...(rules !== undefined && same?.preview
          ? { preview: same.preview, draftRules: rules, dirty: true }
          : {}),
      };
      options.setPublication(operation);
      options.render();
      try {
        const preview = await options.api.preview(id, script.revision, rules);
        if (
          options.getPublication() !== operation ||
          options.selectedScriptId() !== id ||
          options.getScript(id)?.revision !== script.revision
        )
          return;
        Object.assign(operation, {
          preview,
          draftRules: undefined,
          dirty: false,
          expectedPublishedVersion: preview.expectedPublishedVersion,
        });
      } catch {
        if (options.getPublication() === operation)
          operation.error =
            'Preview could not be reviewed. Check the saved revision, 3–4 short points per heading, and bounded unique trigger phrases, then try again.';
      } finally {
        if (options.getPublication() === operation) {
          operation.pending = false;
          options.render();
        }
      }
    },
    async review(form: HTMLFormElement): Promise<void> {
      const active = current();
      if (
        !active ||
        form.dataset.previewKey !== String(active.publication.requestKey)
      )
        return;
      try {
        const data = new form.ownerDocument.defaultView!.FormData(form);
        const rules = readMercuryTriggerForm(data, active.publication.preview!);
        invalidateMercuryApproval(
          active.publication,
          form.parentElement ?? form,
        );
        await controller.preview(
          active.script.id,
          rules,
          active.publication.exampleLabel,
        );
      } catch (error: unknown) {
        active.publication.error =
          error instanceof Error
            ? error.message
            : 'Check the trigger fields before reviewing.';
        invalidateMercuryApproval(
          active.publication,
          form.parentElement ?? form,
        );
        options.render();
      }
    },
    input(target: Element): void {
      const form = target.closest<HTMLFormElement>('[data-trigger-review]');
      const active = current();
      if (
        form &&
        active &&
        form.dataset.previewKey === String(active.publication.requestKey)
      )
        invalidateMercuryApproval(
          active.publication,
          form.parentElement ?? form,
        );
    },
    async example(form: HTMLFormElement): Promise<void> {
      const active = current();
      if (
        !active ||
        form.dataset.previewKey !== String(active.publication.requestKey)
      )
        return;
      // Retain authored edits on unrelated cards while applying the explicit example.
      let existing: MercuryRule[];
      try {
        existing = readMercuryTriggerForm(
          new form.ownerDocument.defaultView!.FormData(form),
          active.publication.preview!,
        );
      } catch (error: unknown) {
        active.publication.error =
          error instanceof Error
            ? error.message
            : 'Review the trigger fields first.';
        invalidateMercuryApproval(
          active.publication,
          form.parentElement ?? form,
        );
        options.render();
        return;
      }
      active.publication.pending = true;
      invalidateMercuryApproval(active.publication, form.parentElement ?? form);
      options.render();
      try {
        const example = await options.api.example();
        if (
          options.getPublication() !== active.publication ||
          options.selectedScriptId() !== active.script.id ||
          options.getScript(active.script.id)?.revision !==
            active.script.revision
        )
          return;
        const rules = existing.map(
          (rule) =>
            example.rules.find(
              (candidate) => candidate.cardId === rule.cardId,
            ) ?? rule,
        );
        active.publication.pending = false;
        const count = existing.filter((rule) =>
          example.rules.some((candidate) => candidate.cardId === rule.cardId),
        ).length;
        await controller.preview(
          active.script.id,
          rules,
          example.label + ' · Applied to ' + count + ' matching cards.',
        );
      } catch {
        if (options.getPublication() === active.publication) {
          active.publication.error =
            'The example could not be loaded. Your unpublished trigger edits remain available.';
        }
      } finally {
        if (options.getPublication() === active.publication) {
          active.publication.pending = false;
          options.render();
        }
      }
    },
    async publish(form: HTMLFormElement): Promise<void> {
      const active = current();
      if (
        !active ||
        active.publication.dirty ||
        form.dataset.previewKey !== String(active.publication.requestKey)
      )
        return;
      const { publication, script } = active;
      const data = new form.ownerDocument.defaultView!.FormData(form);
      if (data.get('approved') !== 'on') return;
      const editor = form.parentElement?.querySelector<HTMLFormElement>(
        '[data-trigger-review]',
      );
      if (!editor) return;
      try {
        // Also catch autofill/programmatic edits that did not emit an input event.
        const edited = readMercuryTriggerForm(
          new form.ownerDocument.defaultView!.FormData(editor),
          publication.preview!,
        );
        if (
          JSON.stringify(edited) !==
          JSON.stringify(editableMercuryRules(publication.preview!))
        ) {
          publication.draftRules = edited;
          invalidateMercuryApproval(publication, form.parentElement ?? form);
          options.render();
          return;
        }
      } catch (error: unknown) {
        publication.error =
          error instanceof Error
            ? error.message
            : 'Review the trigger fields again.';
        invalidateMercuryApproval(publication, form.parentElement ?? form);
        options.render();
        return;
      }
      publication.pending = true;
      publication.error = undefined;
      options.render();
      try {
        const result = await options.api.publish(script.id, {
          expectedRevision: publication.savedRevision,
          expectedPublishedVersion:
            publication.preview!.expectedPublishedVersion,
          rules: publication.preview!.rules,
          reviewToken: publication.preview!.reviewToken,
          approved: true,
        });
        if (options.getPublication() === publication)
          Object.assign(publication, {
            preview: undefined,
            draftRules: undefined,
            dirty: false,
            publishedVersion: result.version,
            expectedPublishedVersion: result.version,
          });
        await options.onPublished?.();
      } catch {
        if (options.getPublication() === publication)
          Object.assign(publication, {
            preview: undefined,
            draftRules: undefined,
            error:
              'Publishing could not be confirmed. Reload the saved source and preview before approving again.',
          });
      } finally {
        if (options.getPublication() === publication) {
          publication.pending = false;
          options.render();
        }
      }
    },
  };
  return controller;
};
