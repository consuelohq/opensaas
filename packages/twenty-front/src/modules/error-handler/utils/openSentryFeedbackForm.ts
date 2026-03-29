type SentryFeedbackFormController = {
  appendToDom: () => void;
  open: () => void;
  removeFromDom: () => void;
};

type OpenSentryFeedbackFormOptions = {
  formTitle?: string;
  submitButtonLabel?: string;
  messagePlaceholder?: string;
};

let activeSentryFeedbackForm: SentryFeedbackFormController | null = null;

export const openSentryFeedbackForm = async (
  options?: OpenSentryFeedbackFormOptions,
) => {
  const Sentry = await import('@sentry/react');
  const feedback = Sentry.getFeedback();

  if (!feedback) {
    return false;
  }

  activeSentryFeedbackForm?.removeFromDom();

  const form = (await feedback.createForm({
    formTitle: options?.formTitle,
    submitButtonLabel: options?.submitButtonLabel,
    messagePlaceholder: options?.messagePlaceholder,
  })) as SentryFeedbackFormController;

  activeSentryFeedbackForm = form;
  form.appendToDom();
  form.open();

  return true;
};
